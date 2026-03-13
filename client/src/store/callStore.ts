import { create } from 'zustand'

export interface LobbyOpt {
  audio: boolean
  video: boolean
}

export type PeerState = 'connecting' | 'connected' | 'failed' | 'closed'

interface CallStore {
  // Lobby opt-in per playerIndex (set before game starts)
  lobbyOpts: Record<number, LobbyOpt>
  myAudioEnabled: boolean
  myVideoEnabled: boolean

  // Live call state
  localStream: MediaStream | null
  remoteStreams: Record<number, MediaStream | null>
  peerStates: Record<number, PeerState>
  mutedPeers: Record<number, boolean>   // other players' mic state (received via socket)
  cameraOffPeers: Record<number, boolean> // other players' cam state
  speakingPeers: Record<number, boolean>  // which players are currently speaking (audio detection)

  // Own controls
  micMuted: boolean
  cameraOff: boolean

  // Actions
  setMyLobbyOpt: (audio: boolean, video: boolean) => void
  setPeerLobbyOpt: (playerIndex: number, audio: boolean, video: boolean) => void
  setLocalStream: (stream: MediaStream | null) => void
  setRemoteStream: (playerIndex: number, stream: MediaStream | null) => void
  setPeerState: (playerIndex: number, state: PeerState) => void
  setMicMuted: (muted: boolean) => void
  setCameraOff: (off: boolean) => void
  setPeerMuted: (playerIndex: number, muted: boolean) => void
  setPeerCameraOff: (playerIndex: number, off: boolean) => void
  setSpeakingPeers: (map: Record<number, boolean>) => void
  resetCallState: () => void
}

const initialState = {
  lobbyOpts: {},
  myAudioEnabled: false,
  myVideoEnabled: false,
  localStream: null,
  remoteStreams: {},
  peerStates: {},
  mutedPeers: {},
  cameraOffPeers: {},
  speakingPeers: {},
  micMuted: false,
  cameraOff: false,
}

export const useCallStore = create<CallStore>()((set) => ({
  ...initialState,

  setMyLobbyOpt: (audio, video) => set({ myAudioEnabled: audio, myVideoEnabled: video }),
  setPeerLobbyOpt: (playerIndex, audio, video) =>
    set(s => ({ lobbyOpts: { ...s.lobbyOpts, [playerIndex]: { audio, video } } })),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (playerIndex, stream) =>
    set(s => ({ remoteStreams: { ...s.remoteStreams, [playerIndex]: stream } })),
  setPeerState: (playerIndex, state) =>
    set(s => ({ peerStates: { ...s.peerStates, [playerIndex]: state } })),
  setMicMuted: (muted) => set({ micMuted: muted }),
  setCameraOff: (off) => set({ cameraOff: off }),
  setPeerMuted: (playerIndex, muted) =>
    set(s => ({ mutedPeers: { ...s.mutedPeers, [playerIndex]: muted } })),
  setPeerCameraOff: (playerIndex, off) =>
    set(s => ({ cameraOffPeers: { ...s.cameraOffPeers, [playerIndex]: off } })),
  setSpeakingPeers: (map) => set({ speakingPeers: map }),
  resetCallState: () => set({ ...initialState }),
}))
