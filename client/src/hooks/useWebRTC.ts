import { useEffect, useRef, useCallback } from 'react'
import { socket } from '../socket'
import { useCallStore } from '../store/callStore'
import { useRoomStore } from '../store/roomStore'
import { useGameStore } from '../store/gameStore'

const METERED_API_KEY = 'a4eeccf14936fa399579d35818687b4c0448'

const FALLBACK_ICE: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'stun:stun.l.google.com:19302' },
  ],
}

const FORCE_RELAY_ONLY = false

let iceConfig: RTCConfiguration = FALLBACK_ICE
let turnFetchPromise: Promise<void> | null = null

function fetchTurnCredentials(): Promise<void> {
  if (turnFetchPromise) return turnFetchPromise
  turnFetchPromise = (async () => {
    try {
      const res = await fetch(
        `https://dominos_pr.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
      )
      const servers = await res.json()
      if (Array.isArray(servers) && servers.length > 0) {
        iceConfig = { iceServers: servers }
        if (FORCE_RELAY_ONLY) iceConfig.iceTransportPolicy = 'relay'
        console.log('[WebRTC] TURN credentials loaded:', servers.length, 'servers')
      } else {
        console.warn('[WebRTC] TURN API returned empty response, using STUN fallback')
      }
    } catch (e) {
      console.warn('[WebRTC] Failed to fetch TURN credentials', e)
      turnFetchPromise = null
    }
  })()
  return turnFetchPromise
}

fetchTurnCredentials()

export function useWebRTC() {
  const myPlayerIndex = useRoomStore.getState().myPlayerIndex ?? 0
  const roomCode = useRoomStore.getState().roomCode

  const pcsRef = useRef<Record<number, RTCPeerConnection>>({})
  const makingOfferRef = useRef<Record<number, boolean>>({})
  const ignoreOfferRef = useRef<Record<number, boolean>>({})
  const localStreamRef = useRef<MediaStream | null>(null)
  // Track failed ICE restart attempts for full reconnection fallback
  const iceRestartAttemptsRef = useRef<Record<number, number>>({})

  const getCallStore = () => useCallStore.getState()

  const acquireLocalStream = useCallback(async (): Promise<MediaStream | null> => {
    const { myAudioEnabled, myVideoEnabled } = getCallStore()
    if (!myAudioEnabled && !myVideoEnabled) return null
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: myVideoEnabled,
        audio: myAudioEnabled,
      })
    } catch {
      if (myVideoEnabled && myAudioEnabled) {
        try { return await navigator.mediaDevices.getUserMedia({ audio: true }) } catch { return null }
      }
      return null
    }
  }, [])

  // Monitor local tracks — re-acquire stream if camera/mic dies (iOS background, OS kill)
  const watchLocalTracks = useCallback((stream: MediaStream) => {
    for (const track of stream.getTracks()) {
      track.onended = async () => {
        console.log(`[WebRTC] Local ${track.kind} track ended — re-acquiring stream`)
        const { myAudioEnabled, myVideoEnabled } = getCallStore()
        if (!myAudioEnabled && !myVideoEnabled) return

        try {
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: myVideoEnabled,
            audio: myAudioEnabled,
          })
          localStreamRef.current = newStream
          getCallStore().setLocalStream(newStream)
          watchLocalTracks(newStream)

          // Replace tracks in all existing PeerConnections
          for (const pc of Object.values(pcsRef.current)) {
            const senders = pc.getSenders()
            for (const newTrack of newStream.getTracks()) {
              const sender = senders.find(s => s.track?.kind === newTrack.kind)
              if (sender) {
                await sender.replaceTrack(newTrack)
                console.log(`[WebRTC] Replaced ${newTrack.kind} track in PC`)
              }
            }
          }
        } catch (e) {
          console.error('[WebRTC] Failed to re-acquire local stream', e)
        }
      }
    }
  }, [])

  // Full reconnection: close PC and create a fresh one
  const reconnectPeer = useCallback((remoteIndex: number) => {
    console.log(`[WebRTC] Full reconnection for peer ${remoteIndex}`)
    const old = pcsRef.current[remoteIndex]
    if (old) {
      old.close()
      delete pcsRef.current[remoteIndex]
    }
    iceRestartAttemptsRef.current[remoteIndex] = 0
    getCallStore().setRemoteStream(remoteIndex, null)
    createPC(remoteIndex)
  }, []) // createPC added below via assignment

  const createPC = useCallback((remoteIndex: number): RTCPeerConnection => {
    const pc = new RTCPeerConnection(iceConfig)
    console.log(`[WebRTC] createPC(${remoteIndex}) with ${iceConfig.iceServers?.length ?? 0} ICE servers`)

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!)
      })
    } else {
      console.warn(`[WebRTC] No local stream when creating PC(${remoteIndex})`)
    }

    let lastIceRestart = 0
    const ICE_RESTART_THROTTLE_MS = 5000
    const MAX_ICE_RESTART_ATTEMPTS = 3

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      console.log(`[WebRTC] ICE(${remoteIndex}): ${state}`)

      if (state === 'connected' || state === 'completed') {
        iceRestartAttemptsRef.current[remoteIndex] = 0
        lastIceRestart = 0
      }

      if (state === 'failed' || state === 'disconnected') {
        const attempts = iceRestartAttemptsRef.current[remoteIndex] ?? 0

        if (attempts >= MAX_ICE_RESTART_ATTEMPTS) {
          // ICE restarts exhausted — do full reconnection
          console.log(`[WebRTC] ICE restart attempts exhausted for peer ${remoteIndex}, full reconnect`)
          setTimeout(() => reconnectPeer(remoteIndex), 500)
          return
        }

        const now = Date.now()
        if (now - lastIceRestart > ICE_RESTART_THROTTLE_MS) {
          lastIceRestart = now
          iceRestartAttemptsRef.current[remoteIndex] = attempts + 1
          console.log(`[WebRTC] ICE restart #${attempts + 1} for peer ${remoteIndex}`)
          pc.restartIce()
        }
      }
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      console.log(`[WebRTC] Connection(${remoteIndex}): ${state}`)
      if (state === 'connected' || state === 'failed' || state === 'closed' || state === 'disconnected') {
        getCallStore().setPeerState(remoteIndex, state as 'connected' | 'failed' | 'closed')
      }
      // Full reconnect if connection outright fails (not just ICE)
      if (state === 'failed') {
        console.log(`[WebRTC] Connection failed for peer ${remoteIndex}, scheduling reconnect`)
        setTimeout(() => reconnectPeer(remoteIndex), 1000)
      }
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('webrtc:signal', { roomCode, to: remoteIndex, candidate })
      }
    }

    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current[remoteIndex] = true
        await pc.setLocalDescription()
        socket.emit('webrtc:signal', { roomCode, to: remoteIndex, desc: pc.localDescription })
      } catch (err) {
        console.error('[WebRTC] negotiationneeded error', err)
      } finally {
        makingOfferRef.current[remoteIndex] = false
      }
    }

    pc.ontrack = ({ streams, track }) => {
      if (streams[0]) {
        console.log(`[WebRTC] Got remote ${track.kind} track from peer ${remoteIndex}`)
        getCallStore().setRemoteStream(remoteIndex, streams[0])

        // Force video re-attach on unmute (iOS background recovery)
        track.onunmute = () => {
          console.log(`[WebRTC] Track ${track.kind} unmuted from peer ${remoteIndex}`)
          // Clone stream reference to force Zustand re-render
          const cloned = new MediaStream(streams[0].getTracks())
          getCallStore().setRemoteStream(remoteIndex, cloned)
        }

        track.onended = () => {
          console.log(`[WebRTC] Remote ${track.kind} track ended from peer ${remoteIndex}`)
        }
      }
    }

    pcsRef.current[remoteIndex] = pc
    getCallStore().setPeerState(remoteIndex, 'connecting')
    return pc
  }, [myPlayerIndex, roomCode, reconnectPeer])

  // Wire up reconnectPeer's dependency on createPC (circular ref)
  // Both are stable callbacks so this is safe
  const reconnectPeerFn = useCallback((remoteIndex: number) => {
    const old = pcsRef.current[remoteIndex]
    if (old) {
      old.close()
      delete pcsRef.current[remoteIndex]
    }
    iceRestartAttemptsRef.current[remoteIndex] = 0
    getCallStore().setRemoteStream(remoteIndex, null)
    createPC(remoteIndex)
  }, [createPC])

  const handleSignal = useCallback(async ({
    from,
    desc,
    candidate,
  }: { from: number; desc?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
    let pc = pcsRef.current[from]
    if (!pc) {
      console.log(`[WebRTC] Creating PC for incoming signal from peer ${from}`)
      pc = createPC(from)
    }
    const polite = myPlayerIndex > from

    try {
      if (desc) {
        const offerCollision =
          desc.type === 'offer' &&
          (makingOfferRef.current[from] || pc.signalingState !== 'stable')

        ignoreOfferRef.current[from] = !polite && offerCollision
        if (ignoreOfferRef.current[from]) return

        await pc.setRemoteDescription(desc)
        if (desc.type === 'offer') {
          await pc.setLocalDescription()
          socket.emit('webrtc:signal', { roomCode, to: from, desc: pc.localDescription })
        }
      } else if (candidate) {
        try {
          await pc.addIceCandidate(candidate)
        } catch (e) {
          if (!ignoreOfferRef.current[from]) throw e
        }
      }
    } catch (err) {
      console.error('[WebRTC] signal handling error', err)
    }
  }, [myPlayerIndex, roomCode, createPC])

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(track => {
      track.onended = null
      track.stop()
    })
    localStreamRef.current = null
    Object.values(pcsRef.current).forEach(pc => pc.close())
    pcsRef.current = {}
    makingOfferRef.current = {}
    ignoreOfferRef.current = {}
    iceRestartAttemptsRef.current = {}
    getCallStore().resetCallState()
  }, [])

  // Soft reset on new game — ICE restart, not full teardown
  const resetForNewGame = useCallback(async () => {
    const { myAudioEnabled, myVideoEnabled } = getCallStore()
    if (!myAudioEnabled && !myVideoEnabled) return

    for (const [idx, pc] of Object.entries(pcsRef.current)) {
      if (pc.connectionState !== 'closed') {
        console.log(`[WebRTC] ICE restart for peer ${idx} (new game)`)
        iceRestartAttemptsRef.current[Number(idx)] = 0
        pc.restartIce()
      }
    }
  }, [])

  const handlePeerJoined = useCallback((peerIndex: number) => {
    const { myAudioEnabled, myVideoEnabled } = getCallStore()
    if (!myAudioEnabled && !myVideoEnabled) return
    console.log(`[WebRTC] Peer ${peerIndex} joined call, refreshing PC`)
    reconnectPeerFn(peerIndex)
  }, [reconnectPeerFn])

  const joinCall = useCallback(async (audio: boolean, video: boolean) => {
    console.log(`[WebRTC] joinCall(audio=${audio}, video=${video})`)
    getCallStore().setMyLobbyOpt(audio, video)

    const stream = await navigator.mediaDevices.getUserMedia({ video, audio }).catch(async () => {
      if (video && audio) return navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
      return null
    })

    if (!stream) {
      console.error('[WebRTC] Failed to get media stream')
      return
    }

    localStreamRef.current = stream
    getCallStore().setLocalStream(stream)
    watchLocalTracks(stream)

    await fetchTurnCredentials()

    const playerCount = useGameStore.getState().gameState?.playerCount ?? 4
    for (let i = 0; i < playerCount; i++) {
      if (i === myPlayerIndex) continue
      const existingPC = pcsRef.current[i]
      if (existingPC) {
        existingPC.close()
        delete pcsRef.current[i]
        getCallStore().setRemoteStream(i, null)
      }
      createPC(i)
    }

    socket.emit('webrtc:lobby_opt', { roomCode, audio, video })
  }, [myPlayerIndex, roomCode, createPC, watchLocalTracks])

  useEffect(() => {
    let mounted = true

    async function init() {
      await fetchTurnCredentials()

      const stream = await acquireLocalStream()
      if (!mounted) {
        stream?.getTracks().forEach(t => t.stop())
        return
      }
      localStreamRef.current = stream
      getCallStore().setLocalStream(stream)
      if (stream) watchLocalTracks(stream)

      const { lobbyOpts, myAudioEnabled, myVideoEnabled } = getCallStore()
      const iParticipate = myAudioEnabled || myVideoEnabled

      if (iParticipate) {
        const playerCount = useGameStore.getState().gameState?.playerCount ?? 4
        for (let i = 0; i < playerCount; i++) {
          if (i === myPlayerIndex) continue
          const peerOpt = lobbyOpts[i]
          if (peerOpt?.audio || peerOpt?.video) {
            createPC(i)
          }
        }
      }
    }

    init()

    signalHandlerRef.current = handleSignal
    joinCallRef.current = joinCall
    peerJoinedCallRef.current = handlePeerJoined
    resetForNewGameRef.current = resetForNewGame

    return () => {
      mounted = false
      joinCallRef.current = null
      peerJoinedCallRef.current = null
      resetForNewGameRef.current = null
      cleanup()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { handleSignal, cleanup, joinCall }
}

export const signalHandlerRef = {
  current: null as ((data: { from: number; desc?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => void) | null
}

export const joinCallRef = {
  current: null as ((audio: boolean, video: boolean) => Promise<void>) | null
}

export const peerJoinedCallRef = {
  current: null as ((peerIndex: number) => void) | null
}

export const resetForNewGameRef = {
  current: null as (() => Promise<void>) | null
}
