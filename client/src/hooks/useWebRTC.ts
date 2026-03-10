import { useEffect, useRef, useCallback } from 'react'
import { socket } from '../socket'
import { useCallStore } from '../store/callStore'
import { useRoomStore } from '../store/roomStore'

const STUN_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

export function useWebRTC() {
  const myPlayerIndex = useRoomStore.getState().myPlayerIndex ?? 0
  const roomCode = useRoomStore.getState().roomCode

  // Store PCs in ref — never in state (prevents re-render on change)
  const pcsRef = useRef<Record<number, RTCPeerConnection>>({})
  const makingOfferRef = useRef<Record<number, boolean>>({})
  const ignoreOfferRef = useRef<Record<number, boolean>>({})
  const localStreamRef = useRef<MediaStream | null>(null)

  const getCallStore = () => useCallStore.getState()

  // Acquire local media stream
  const acquireLocalStream = useCallback(async (): Promise<MediaStream | null> => {
    const { myAudioEnabled, myVideoEnabled } = getCallStore()
    if (!myAudioEnabled && !myVideoEnabled) return null
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: myVideoEnabled,
        audio: myAudioEnabled,
      })
      return stream
    } catch {
      // Fallback: audio only
      if (myVideoEnabled && myAudioEnabled) {
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch {
          return null
        }
      }
      return null
    }
  }, [])

  // Create a peer connection for one remote player
  const createPC = useCallback((remoteIndex: number): RTCPeerConnection => {
    const pc = new RTCPeerConnection(STUN_CONFIG)

    // Add local tracks to this connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!)
      })
    }

    // ICE connection fallback timeout: if still 'connecting' after 15s, mark as failed
    const timeoutId = setTimeout(() => {
      if (pc.connectionState === 'connecting' || pc.iceConnectionState === 'checking') {
        getCallStore().setPeerState(remoteIndex, 'failed')
      }
    }, 15000)

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state !== 'connecting' && state !== 'new') clearTimeout(timeoutId)
      if (state === 'connected' || state === 'failed' || state === 'closed') {
        getCallStore().setPeerState(remoteIndex, state as 'connected' | 'failed' | 'closed')
      }
    }

    // Perfect Negotiation: onnegotiationneeded
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current[remoteIndex] = true
        await pc.setLocalDescription()
        socket.emit('webrtc:signal', { roomCode, to: remoteIndex, desc: pc.localDescription })
      } catch (err) {
        console.error('negotiationneeded error', err)
      } finally {
        makingOfferRef.current[remoteIndex] = false
      }
    }

    // Send ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('webrtc:signal', { roomCode, to: remoteIndex, candidate })
      }
    }

    // Receive remote stream
    pc.ontrack = ({ streams }) => {
      if (streams[0]) {
        getCallStore().setRemoteStream(remoteIndex, streams[0])
      }
    }

    pcsRef.current[remoteIndex] = pc
    getCallStore().setPeerState(remoteIndex, 'connecting')
    return pc
  }, [myPlayerIndex, roomCode])

  // Handle incoming signal from server (Perfect Negotiation pattern)
  const handleSignal = useCallback(async ({
    from,
    desc,
    candidate,
  }: { from: number; desc?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
    let pc = pcsRef.current[from]
    if (!pc) {
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
      console.error('webrtc:signal handling error', err)
    }
  }, [myPlayerIndex, roomCode, createPC])

  // Cleanup function
  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(track => track.stop())
    localStreamRef.current = null
    Object.values(pcsRef.current).forEach(pc => pc.close())
    pcsRef.current = {}
    makingOfferRef.current = {}
    ignoreOfferRef.current = {}
    getCallStore().resetCallState()
  }, [])

  // Initialize: get media, create PCs for all opted-in peers, register socket handler
  useEffect(() => {
    let mounted = true

    async function init() {
      const stream = await acquireLocalStream()
      if (!mounted) {
        stream?.getTracks().forEach(t => t.stop())
        return
      }
      localStreamRef.current = stream
      getCallStore().setLocalStream(stream)

      // Create peer connections to all other opted-in players
      const { lobbyOpts, myAudioEnabled, myVideoEnabled } = getCallStore()
      const iParticipate = myAudioEnabled || myVideoEnabled

      if (iParticipate) {
        for (let i = 0; i < 4; i++) {
          if (i === myPlayerIndex) continue
          const peerOpt = lobbyOpts[i]
          if (peerOpt?.audio || peerOpt?.video) {
            createPC(i)
          }
        }
      }
    }

    init()

    // Register signal handler — expose via ref so useSocket can call it
    signalHandlerRef.current = handleSignal

    return () => {
      mounted = false
      cleanup()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { handleSignal, cleanup }
}

// Shared ref so useSocket.ts can route 'webrtc:signal' events to the hook instance
export const signalHandlerRef = {
  current: null as ((data: { from: number; desc?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => void) | null
}
