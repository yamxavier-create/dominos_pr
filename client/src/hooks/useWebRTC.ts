import { useEffect, useRef, useCallback } from 'react'
import { socket } from '../socket'
import { useCallStore, LobbyOpt } from '../store/callStore'
import type { RoomInfo } from '../types/game'
import { useRoomStore } from '../store/roomStore'
import { applyMediaPrefs, capabilitiesOf, stopStream } from './webrtc/mediaPrefs'
import { CallSession } from './webrtc/callSession'
import { createReconnectScheduler } from './webrtc/reconnectScheduler'

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

/** My seat right now. Seats move in the room (swaps, someone leaving), so never cache it. */
function mySeat(): number {
  return useRoomStore.getState().myPlayerIndex ?? 0
}

/** Seats a call can connect to: the other humans in the room. Bots never take part. */
function humanPeers(): number[] {
  const me = mySeat()
  const players = useRoomStore.getState().room?.players ?? []
  return players.filter(p => !p.isBot && p.index !== me).map(p => p.index)
}

/** Every signal carries the seat layout it was meant for; the server drops stale ones. */
function sendSignal(roomCode: string, payload: { to: number; desc?: RTCSessionDescription | null; candidate?: RTCIceCandidate }) {
  socket.emit('webrtc:signal', { roomCode, epoch: useRoomStore.getState().room?.callEpoch, ...payload })
}

/** Tell the room my mic and camera state (new peers, or after seats moved). */
function announceMyToggles(roomCode: string) {
  const { micMuted, cameraOff } = useCallStore.getState()
  socket.emit('webrtc:toggle', { roomCode, micMuted, cameraOff })
}

/** getUserMedia with the audio-only fallback when the camera is refused or missing. */
async function requestMedia(audio: boolean, video: boolean): Promise<MediaStream | null> {
  if (!audio && !video) return null
  try {
    return await navigator.mediaDevices.getUserMedia({ audio, video })
  } catch {
    if (audio && video) {
      try { return await navigator.mediaDevices.getUserMedia({ audio: true }) } catch { return null }
    }
    return null
  }
}

/**
 * The video call of the current room. Mounted once per room (see CallHost),
 * so it starts in the lobby and keeps running through every game.
 */
export function useWebRTC() {
  const roomCode = useRoomStore.getState().roomCode

  const pcsRef = useRef<Record<number, RTCPeerConnection>>({})
  const makingOfferRef = useRef<Record<number, boolean>>({})
  const ignoreOfferRef = useRef<Record<number, boolean>>({})
  const localStreamRef = useRef<MediaStream | null>(null)
  // Track failed ICE restart attempts for full reconnection fallback
  const iceRestartAttemptsRef = useRef<Record<number, number>>({})
  const sessionRef = useRef(new CallSession())
  // Recovering the local stream is serialized: one re-acquisition at a time
  const recoveringRef = useRef<Promise<void> | null>(null)
  const createPCRef = useRef<(remoteIndex: number) => RTCPeerConnection>(null!)

  const getCallStore = () => useCallStore.getState()

  const closePeer = useCallback((remoteIndex: number) => {
    reconnects.current.cancel(remoteIndex)
    const pc = pcsRef.current[remoteIndex]
    if (pc) {
      pc.close()
      delete pcsRef.current[remoteIndex]
    }
    iceRestartAttemptsRef.current[remoteIndex] = 0
    getCallStore().setRemoteStream(remoteIndex, null)
  }, [])

  // Full reconnection: close PC and create a fresh one
  const reconnectPeer = useCallback((remoteIndex: number) => {
    console.log(`[WebRTC] Full reconnection for peer ${remoteIndex}`)
    closePeer(remoteIndex)
    createPCRef.current(remoteIndex)
  }, [closePeer])

  const reconnects = useRef(createReconnectScheduler<RTCPeerConnection>({
    isActive: () => sessionRef.current.isCurrent(sessionRef.current.current()),
    currentPc: peer => pcsRef.current[peer],
    reconnect: peer => reconnectPeer(peer),
  }))

  /** Make `stream` the published local stream: apply mute/camera, swap tracks in every PC, stop the old one. */
  const publishLocalStream = useCallback(async (stream: MediaStream) => {
    const { micMuted, cameraOff } = getCallStore()
    applyMediaPrefs(stream, { micMuted, cameraOff })

    const previous = localStreamRef.current
    localStreamRef.current = stream
    getCallStore().setLocalStream(stream)
    watchLocalTracks(stream)

    for (const pc of Object.values(pcsRef.current)) {
      const senders = pc.getSenders()
      for (const track of stream.getTracks()) {
        const sender = senders.find(s => s.track?.kind === track.kind)
        if (sender) await sender.replaceTrack(track)
      }
    }
    if (previous && previous !== stream) {
      previous.getTracks().forEach(t => { t.onended = null })
      stopStream(previous)
    }
  }, [])

  // Monitor local tracks — re-acquire stream if camera/mic dies (iOS background, OS kill)
  const watchLocalTracks = useCallback((stream: MediaStream) => {
    for (const track of stream.getTracks()) {
      track.onended = () => {
        if (recoveringRef.current) return
        console.log(`[WebRTC] Local ${track.kind} track ended — re-acquiring stream`)
        const session = sessionRef.current.current()
        recoveringRef.current = (async () => {
          const { myAudioEnabled, myVideoEnabled } = getCallStore()
          const fresh = await requestMedia(myAudioEnabled, myVideoEnabled)
          if (!sessionRef.current.isCurrent(session)) {
            stopStream(fresh)
            return
          }
          if (!fresh) {
            console.error('[WebRTC] Failed to re-acquire local stream')
            return
          }
          await publishLocalStream(fresh)
        })().finally(() => { recoveringRef.current = null })
      }
    }
  }, [publishLocalStream])

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
          reconnects.current.schedule(remoteIndex, pc, 500)
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
        reconnects.current.schedule(remoteIndex, pc, 1000)
      }
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendSignal(roomCode, { to: remoteIndex, candidate })
      }
    }

    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current[remoteIndex] = true
        await pc.setLocalDescription()
        sendSignal(roomCode, { to: remoteIndex, desc: pc.localDescription })
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
  }, [roomCode])
  createPCRef.current = createPC

  const handleSignal = useCallback(async ({
    from,
    desc,
    candidate,
  }: { from: number; desc?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
    if (!sessionRef.current.isCurrent(sessionRef.current.current())) return
    let pc = pcsRef.current[from]
    if (!pc) {
      console.log(`[WebRTC] Creating PC for incoming signal from peer ${from}`)
      pc = createPC(from)
    }
    const polite = mySeat() > from

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
          sendSignal(roomCode, { to: from, desc: pc.localDescription })
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
  }, [roomCode, createPC])

  const cleanup = useCallback(() => {
    // Ends the session first: any pending permission prompt or recovery becomes stale
    sessionRef.current.end()
    reconnects.current.cancelAll()
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

  /**
   * Seats moved (swap, someone left, back from a game): every index now names
   * someone else, so drop all connections and connect again by the new seats.
   * Whoever is in the call offers; the rest answer.
   */
  const rebuildCall = useCallback(() => {
    console.log('[WebRTC] Seats changed, rebuilding the call')
    for (const idx of Object.keys(pcsRef.current)) closePeer(Number(idx))
    getCallStore().clearPeers()
    if (!localStreamRef.current) return
    for (const i of humanPeers()) createPC(i)
    announceMyToggles(roomCode)
  }, [roomCode, closePeer, createPC])

  const handlePeerJoined = useCallback((peerIndex: number) => {
    const { myAudioEnabled, myVideoEnabled } = getCallStore()
    if (!myAudioEnabled && !myVideoEnabled) return
    console.log(`[WebRTC] Peer ${peerIndex} joined call, refreshing PC`)
    reconnectPeer(peerIndex)
    announceMyToggles(roomCode)
  }, [reconnectPeer, roomCode])

  // The server says this seat's human is gone (bot took over or they abandoned)
  const handlePeerLeft = useCallback((peerIndex: number) => {
    console.log(`[WebRTC] Peer ${peerIndex} left the call`)
    closePeer(peerIndex)
    getCallStore().setPeerState(peerIndex, 'closed')
  }, [closePeer])

  const joinCall = useCallback(async (audio: boolean, video: boolean) => {
    console.log(`[WebRTC] joinCall(audio=${audio}, video=${video})`)
    const session = sessionRef.current.current()
    getCallStore().setCallError(null)

    const stream = await requestMedia(audio, video)
    if (!sessionRef.current.isCurrent(session)) {
      // Left the game while the permission prompt was open
      console.log('[WebRTC] joinCall: call session ended during the permission prompt, discarding stream')
      stopStream(stream)
      return
    }
    if (!stream) {
      // Not in the call: keep the join button so the player can retry after allowing access
      console.error('[WebRTC] Failed to get media stream')
      getCallStore().setCallError('No se pudo usar la cámara ni el micrófono. Revisa los permisos y vuelve a intentar.')
      return
    }

    // Join with what we actually got (the audio-only fallback may drop video)
    const caps = capabilitiesOf(stream)
    getCallStore().setMyLobbyOpt(caps.audio, caps.video)
    await publishLocalStream(stream)

    await fetchTurnCredentials()
    if (!sessionRef.current.isCurrent(session)) return

    for (const i of humanPeers()) {
      closePeer(i)
      createPC(i)
    }

    socket.emit('webrtc:lobby_opt', { roomCode, audio: caps.audio, video: caps.video })
    announceMyToggles(roomCode)
  }, [roomCode, createPC, closePeer, publishLocalStream])

  useEffect(() => {
    const session = sessionRef.current.begin()

    async function init() {
      // The lobby opt-in as it was on arrival. Read before any await: a tap on
      // "join call" meanwhile is joinCall's job, and init must not race it.
      const { myAudioEnabled, myVideoEnabled } = getCallStore()

      await fetchTurnCredentials()
      if (!sessionRef.current.isCurrent(session)) return

      const stream = await requestMedia(myAudioEnabled, myVideoEnabled)
      if (!sessionRef.current.isCurrent(session) || localStreamRef.current) {
        // Left the game, or joinCall already published a stream
        stopStream(stream)
        return
      }

      if (!stream) {
        // Opted in from the lobby but access failed: don't pretend to be in the call
        if (myAudioEnabled || myVideoEnabled) getCallStore().setMyLobbyOpt(false, false)
        return
      }
      const caps = capabilitiesOf(stream)
      getCallStore().setMyLobbyOpt(caps.audio, caps.video)
      await publishLocalStream(stream)

      const { lobbyOpts } = getCallStore()
      for (const i of humanPeers()) {
        const peerOpt = lobbyOpts[i]
        if (peerOpt?.audio || peerOpt?.video) createPC(i)
      }
    }

    init()

    // Follow the room: who is in the call, and seat changes
    let epoch = useRoomStore.getState().room?.callEpoch ?? 0
    syncFromRoom(useRoomStore.getState().room)
    const unsubscribe = useRoomStore.subscribe((state, prev) => {
      if (state.room === prev.room) return
      syncFromRoom(state.room)
      const next = state.room?.callEpoch ?? epoch
      if (next !== epoch) {
        epoch = next
        rebuildCall()
        return
      }
      // A seat that no longer holds a human (left the room, bot took it): hang up on it
      const humans = new Set(humanPeers())
      for (const idx of Object.keys(pcsRef.current).map(Number)) {
        if (!humans.has(idx)) closePeer(idx)
      }
    })

    signalHandlerRef.current = handleSignal
    joinCallRef.current = joinCall
    peerJoinedCallRef.current = handlePeerJoined
    peerLeftCallRef.current = handlePeerLeft

    return () => {
      unsubscribe()
      signalHandlerRef.current = null
      joinCallRef.current = null
      peerJoinedCallRef.current = null
      peerLeftCallRef.current = null
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

export const peerLeftCallRef = {
  current: null as ((peerIndex: number) => void) | null
}

/** Who is in the call, as the room last reported it. */
function syncFromRoom(room: RoomInfo | null) {
  const opts: Record<number, LobbyOpt> = {}
  for (const p of room?.players ?? []) {
    if (p.call) opts[p.index] = { audio: p.call.audio, video: p.call.video }
  }
  useCallStore.getState().setLobbyOpts(opts)
}
