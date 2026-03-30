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

// Debug: set to true to force TURN-only (no direct/STUN connections)
// Useful for testing if TURN servers actually work
const FORCE_RELAY_ONLY = false

// Module-level ICE config — fetched once, used everywhere synchronously
let iceConfig: RTCConfiguration = FALLBACK_ICE
let turnFetchPromise: Promise<void> | null = null

// Pre-fetch TURN credentials — returns stored promise to avoid duplicate fetches
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
        if (FORCE_RELAY_ONLY) {
          iceConfig.iceTransportPolicy = 'relay'
        }
        console.log('[WebRTC] TURN credentials loaded:', servers.length, 'servers')
        servers.forEach((s: RTCIceServer, i: number) => {
          console.log(`[WebRTC]   server[${i}]: ${JSON.stringify(s.urls)}`)
        })
      } else {
        console.warn('[WebRTC] TURN API returned empty/invalid response, using STUN fallback')
      }
    } catch (e) {
      console.warn('[WebRTC] Failed to fetch TURN credentials, using STUN fallback', e)
      turnFetchPromise = null // Allow retry on failure
    }
  })()
  return turnFetchPromise
}

// Fetch immediately on module load
fetchTurnCredentials()

export function useWebRTC() {
  const myPlayerIndex = useRoomStore.getState().myPlayerIndex ?? 0
  const roomCode = useRoomStore.getState().roomCode

  const pcsRef = useRef<Record<number, RTCPeerConnection>>({})
  const makingOfferRef = useRef<Record<number, boolean>>({})
  const ignoreOfferRef = useRef<Record<number, boolean>>({})
  const localStreamRef = useRef<MediaStream | null>(null)
  const wasInCallRef = useRef(false)

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

  // Synchronous — uses module-level iceConfig (already fetched)
  const createPC = useCallback((remoteIndex: number): RTCPeerConnection => {
    const pc = new RTCPeerConnection(iceConfig)
    console.log(`[WebRTC] createPC(${remoteIndex}) with ${iceConfig.iceServers?.length ?? 0} ICE servers`)

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!)
      })
      console.log(`[WebRTC] Added ${localStreamRef.current.getTracks().length} local tracks to PC(${remoteIndex})`)
    } else {
      console.warn(`[WebRTC] No local stream when creating PC(${remoteIndex})`)
    }

    // ICE restart with throttle — max once per 5 seconds, resets on success
    let lastIceRestart = 0
    const ICE_RESTART_THROTTLE_MS = 5000

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState
      console.log(`[WebRTC] ICE(${remoteIndex}): ${state}`)
      if (state === 'connected' || state === 'completed') {
        lastIceRestart = 0 // Reset throttle on success — allow future restarts
        console.log(`[WebRTC] ICE(${remoteIndex}): connection established successfully`)
      }
      if (state === 'failed' || state === 'disconnected') {
        const now = Date.now()
        if (now - lastIceRestart > ICE_RESTART_THROTTLE_MS) {
          lastIceRestart = now
          console.log(`[WebRTC] ICE restart for peer ${remoteIndex} (state=${state})`)
          pc.restartIce()
        } else {
          console.log(`[WebRTC] ICE restart throttled for peer ${remoteIndex} (${ICE_RESTART_THROTTLE_MS}ms cooldown)`)
        }
      }
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      console.log(`[WebRTC] Connection(${remoteIndex}): ${state}`)
      if (state === 'connected' || state === 'failed' || state === 'closed' || state === 'disconnected') {
        getCallStore().setPeerState(remoteIndex, state as 'connected' | 'failed' | 'closed')
      }
    }

    // Log ICE candidate types to verify TURN relay is being used
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        const type = candidate.type ?? 'unknown' // host, srflx, prflx, relay
        console.log(`[WebRTC] ICE candidate(${remoteIndex}): type=${type} protocol=${candidate.protocol} address=${candidate.address}`)
        socket.emit('webrtc:signal', { roomCode, to: remoteIndex, candidate })
      } else {
        console.log(`[WebRTC] ICE gathering complete for peer ${remoteIndex}`)
      }
    }

    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current[remoteIndex] = true
        await pc.setLocalDescription()
        socket.emit('webrtc:signal', { roomCode, to: remoteIndex, desc: pc.localDescription })
        console.log(`[WebRTC] Sent offer to peer ${remoteIndex}`)
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

        // Re-set stream when track unmutes/restarts (iOS background recovery)
        track.onunmute = () => {
          console.log(`[WebRTC] Track ${track.kind} unmuted from peer ${remoteIndex}`)
          getCallStore().setRemoteStream(remoteIndex, streams[0])
        }
        track.onended = () => {
          console.log(`[WebRTC] Track ${track.kind} ended from peer ${remoteIndex}`)
        }
      }
    }

    pcsRef.current[remoteIndex] = pc
    getCallStore().setPeerState(remoteIndex, 'connecting')
    return pc
  }, [myPlayerIndex, roomCode])

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
        if (ignoreOfferRef.current[from]) {
          console.log(`[WebRTC] Ignoring colliding offer from peer ${from} (impolite)`)
          return
        }

        await pc.setRemoteDescription(desc)
        if (desc.type === 'offer') {
          await pc.setLocalDescription()
          socket.emit('webrtc:signal', { roomCode, to: from, desc: pc.localDescription })
          console.log(`[WebRTC] Sent answer to peer ${from}`)
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
    localStreamRef.current?.getTracks().forEach(track => track.stop())
    localStreamRef.current = null
    Object.values(pcsRef.current).forEach(pc => pc.close())
    pcsRef.current = {}
    makingOfferRef.current = {}
    ignoreOfferRef.current = {}
    getCallStore().resetCallState()
  }, [])

  // When a new game starts, do a soft reset — ICE restart existing PCs
  // instead of full teardown to avoid video glitches
  const resetForNewGame = useCallback(async () => {
    const { myAudioEnabled, myVideoEnabled } = getCallStore()
    const wasInCall = myAudioEnabled || myVideoEnabled

    if (!wasInCall) return

    // Soft reset: ICE restart all existing PCs to refresh connections
    // This preserves streams and avoids the 300ms gap from full teardown
    for (const [idx, pc] of Object.entries(pcsRef.current)) {
      if (pc.connectionState !== 'closed') {
        console.log(`[WebRTC] ICE restart for peer ${idx} (new game)`)
        pc.restartIce()
      }
    }
  }, [])

  const handlePeerJoined = useCallback((peerIndex: number) => {
    const { myAudioEnabled, myVideoEnabled } = getCallStore()
    if (!myAudioEnabled && !myVideoEnabled) return
    console.log(`[WebRTC] Peer ${peerIndex} joined call, refreshing PC`)
    const old = pcsRef.current[peerIndex]
    if (old) {
      old.close()
      delete pcsRef.current[peerIndex]
      getCallStore().setRemoteStream(peerIndex, null)
    }
    createPC(peerIndex)
  }, [createPC])

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
    console.log(`[WebRTC] Got local stream: ${stream.getTracks().map(t => t.kind).join(', ')}`)
    localStreamRef.current = stream
    getCallStore().setLocalStream(stream)

    // Always await TURN credentials before creating PCs
    await fetchTurnCredentials()
    console.log(`[WebRTC] ICE config ready: ${iceConfig.iceServers?.length ?? 0} servers, relay-only=${FORCE_RELAY_ONLY}`)

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
    console.log(`[WebRTC] Emitted webrtc:lobby_opt, created PCs for ${playerCount - 1} peers`)
  }, [myPlayerIndex, roomCode, createPC])

  useEffect(() => {
    let mounted = true

    async function init() {
      // Always await TURN credentials before anything else
      await fetchTurnCredentials()

      const stream = await acquireLocalStream()
      if (!mounted) {
        stream?.getTracks().forEach(t => t.stop())
        return
      }
      localStreamRef.current = stream
      getCallStore().setLocalStream(stream)

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
