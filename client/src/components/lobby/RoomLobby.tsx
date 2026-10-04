import { useState, useEffect, useRef } from 'react'
import { useRoomStore } from '../../store/roomStore'
import { useGameActions } from '../../hooks/useGameActions'
import { socket } from '../../socket'
import { useCallStore } from '../../store/callStore'
import { useAuthStore } from '../../store/authStore'
import { useSocialStore, Friend } from '../../store/socialStore'
import { API_BASE } from '../../apiBase'
import { GoldCTA, GoldCaption, Starburst } from '../ui/GoldCTA'
import { joinCallRef } from '../../hooks/useWebRTC'
import { useVideoStream } from '../player/AvatarVideo'
import { useCallToggles, MicIcon, CameraIcon } from '../player/CallControls'

const teamColors = ['#22C55E', '#F97316', '#22C55E', '#F97316']
const seatLabels = ['Host', 'Jugador 2', 'Jugador 3', 'Jugador 4']
const teamLabels = ['A', 'B', 'A', 'B']

function WaitingDots() {
  return (
    <span className="waiting-dots inline-flex gap-0.5">
      <span className="inline-block w-1 h-1 rounded-full bg-white/40" />
      <span className="inline-block w-1 h-1 rounded-full bg-white/40" />
      <span className="inline-block w-1 h-1 rounded-full bg-white/40" />
    </span>
  )
}

function StrokeIcon({ children, className = 'w-4 h-4' }: { children: React.ReactNode; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

/** A seat's camera in the room: live video, or the player's initials when there's none. */
function SeatVideo({ seatIndex, name, isMe, color }: { seatIndex: number; name: string; isMe: boolean; color: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stream = useCallStore(s => isMe ? s.localStream : (s.remoteStreams[seatIndex] ?? null))
  const cameraOff = useCallStore(s => isMe ? s.cameraOff : !!s.cameraOffPeers[seatIndex])
  const speaking = useCallStore(s => !!s.speakingPeers[seatIndex])
  const hasVideo = !!stream && stream.getVideoTracks().length > 0 && !cameraOff
  useVideoStream(videoRef, stream, hasVideo)

  return (
    <div
      className="relative w-full aspect-[4/3] rounded-[10px] overflow-hidden"
      style={{
        background: `${color}22`,
        boxShadow: speaking ? `0 0 0 2px #F5C518, 0 0 14px rgba(245,197,24,0.35)` : 'inset 0 0 0 1px rgba(255,255,255,0.06)',
        transition: 'box-shadow 0.2s',
      }}
    >
      {hasVideo ? (
        // Muted: the room's audio plays from CallHost
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={isMe ? { transform: 'scaleX(-1)' } : undefined}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center font-header text-3xl" style={{ color: `${color}cc` }}>
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  )
}

/** Join the call from the room, or once in it, mic and camera switches. */
function LobbyCallBar({ peopleInCall }: { peopleInCall: number }) {
  const inCall = useCallStore(s => s.myAudioEnabled || s.myVideoEnabled)
  const callError = useCallStore(s => s.callError)
  const [joining, setJoining] = useState(false)
  const { micMuted, cameraOff, toggleMic, toggleCamera } = useCallToggles()

  const joinCall = async () => {
    setJoining(true)
    try {
      await joinCallRef.current?.(true, true)
    } finally {
      setJoining(false)
    }
  }

  if (!inCall) {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={joinCall}
          disabled={joining}
          className="w-full flex items-center justify-center gap-2 font-body font-semibold text-sm py-3 rounded-xl transition-all disabled:opacity-60"
          style={{ background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.45)', color: '#86EFAC' }}
        >
          <StrokeIcon><path d="M3 7h11v10H3z" /><path d="M14 10.5l7-3.5v10l-7-3.5" /></StrokeIcon>
          {joining ? 'Conectando…' : 'Unirse a la llamada'}
        </button>
        {callError && (
          <p role="alert" className="font-body text-xs text-center" style={{ color: '#FCA5A5' }}>{callError}</p>
        )}
        {!callError && peopleInCall > 0 && (
          <p className="font-body text-white/40 text-[11px] text-center">
            {peopleInCall === 1 ? '1 persona en la llamada' : `${peopleInCall} personas en la llamada`}
          </p>
        )}
      </div>
    )
  }

  const toggle = (label: string, off: boolean, onClick: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={off}
      title={label}
      className="w-11 h-11 rounded-full flex items-center justify-center transition-colors"
      style={off
        ? { background: 'rgba(220,38,38,0.85)', color: '#fff' }
        : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: '#F5C518' }}
    >
      <StrokeIcon className="w-5 h-5">{icon}</StrokeIcon>
    </button>
  )

  return (
    <div className="flex items-center justify-center gap-3">
      {toggle(micMuted ? 'Activar mic' : 'Silenciar mic', micMuted, toggleMic, <MicIcon muted={micMuted} />)}
      {toggle(cameraOff ? 'Activar camara' : 'Apagar camara', cameraOff, toggleCamera, <CameraIcon off={cameraOff} />)}
      <span className="font-body text-xs text-white/50">
        En la llamada · {peopleInCall}
      </span>
    </div>
  )
}

export function RoomLobby() {
  const room = useRoomStore(s => s.room)
  const roomCode = useRoomStore(s => s.roomCode)
  const myPlayerIndex = useRoomStore(s => s.myPlayerIndex)
  const { startGame } = useGameActions()
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const lobbyOpts = useCallStore(s => s.lobbyOpts)
  const mutedPeers = useCallStore(s => s.mutedPeers)
  const myMicMuted = useCallStore(s => s.micMuted)
  const iAmInCall = useCallStore(s => s.myAudioEnabled || s.myVideoEnabled)
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const token = useAuthStore(s => s.token)
  const friends = useSocialStore(s => s.friends)
  const setFriends = useSocialStore(s => s.setFriends)

  // Fetch friends when invite panel opens
  useEffect(() => {
    if (!showInvite || !token) return
    fetch(`${API_BASE}/api/social/friends`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setFriends(data.friends))
      .catch(() => {})
  }, [showInvite, token])

  const sendInvite = (friendId: string) => {
    socket.emit('social:invite_to_game', { friendUserId: friendId })
    setInvitedIds(prev => new Set(prev).add(friendId))
  }

  if (!room) return null

  const isHost = myPlayerIndex === 0
  const playerCount = room.players.filter(p => p.connected).length
  const canStart = playerCount === 2 || playerCount === 4
  const is2PlayerLobby = playerCount <= 2
  const inCallAt = (seatIndex: number) => seatIndex === myPlayerIndex ? iAmInCall : !!(lobbyOpts[seatIndex]?.audio || lobbyOpts[seatIndex]?.video)
  const peopleInCall = room.players.filter(p => !p.isBot && inCallAt(p.index)).length

  const handleSeatClick = (seatIndex: number) => {
    if (!isHost) return
    const player = room.players.find(p => p.index === seatIndex)
    if (!player) return
    if (selectedSeat === null) {
      setSelectedSeat(seatIndex)
    } else if (selectedSeat === seatIndex) {
      setSelectedSeat(null)
    } else {
      socket.emit('room:swap_seats', { seatA: selectedSeat, seatB: seatIndex })
      setSelectedSeat(null)
    }
  }

  return (
    <div className="menu-reveal flex flex-col gap-3 w-full max-w-sm">
      {/* Room code hero */}
      <div className="relative flex flex-col items-center py-2">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-56 h-56">
            <Starburst opacity={0.22} />
          </div>
        </div>
        <div className="relative flex flex-col items-center">
          <GoldCaption>Código de Sala</GoldCaption>
          <p
            className="font-header text-[2.6rem] leading-none mt-1.5 room-code-glow"
            style={{
              color: '#EAB308',
              letterSpacing: '0.12em',
              textShadow: '0 0 40px rgba(234,179,8,0.45), 0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            {room.roomCode}
          </p>
          <p className="font-body text-white/40 text-xs mt-2">
            Modo: <span style={{ color: '#22C55E' }}>{room.gameMode === 'modo200' ? 'Modo 200 (20 pts)' : 'Modo 500'}</span>
          </p>
        </div>
      </div>

      {/* Players grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {[0, 1, 2, 3].map(seatIndex => {
          const player = room.players.find(p => p.index === seatIndex)
          const isMe = seatIndex === myPlayerIndex
          const color = teamColors[seatIndex]
          const label = teamLabels[seatIndex]
          const isSelected = selectedSeat === seatIndex
          const isSwapTarget = selectedSeat !== null && selectedSeat !== seatIndex && !!player

          return (
            <div
              key={seatIndex}
              onClick={() => handleSeatClick(seatIndex)}
              className={`p-2 transition-all ${player ? 'seat-card' : 'seat-card-empty'} ${isHost && player ? 'cursor-pointer' : ''}`}
              style={{
                ...(isSelected ? {
                  background: 'rgba(234,179,8,0.08)',
                  borderColor: '#facc15',
                  borderStyle: 'solid',
                  borderWidth: '1.5px',
                } : isSwapTarget ? {
                  borderColor: 'rgba(250,204,21,0.4)',
                  borderStyle: 'dashed',
                  borderWidth: '1.5px',
                } : isMe ? {
                  borderColor: `${color}44`,
                  borderStyle: 'solid',
                  borderWidth: '1.5px',
                  boxShadow: `0 0 12px ${color}15`,
                } : {}),
              }}
            >
              {player && !player.isBot ? (
                <SeatVideo seatIndex={seatIndex} name={player.name} isMe={isMe} color={color} />
              ) : (
                <div
                  className="w-full aspect-[4/3] rounded-[10px] flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.025)' }}
                >
                  {player?.isBot ? (
                    <span className="text-3xl opacity-60" aria-hidden>🤖</span>
                  ) : isHost ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); socket.emit('room:add_bot') }}
                      className="font-body text-primary/60 hover:text-primary text-sm transition-colors"
                    >
                      + Añadir Bot
                    </button>
                  ) : (
                    <p className="font-body text-white/25 text-xs italic">
                      Esperando <WaitingDots />
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2 min-h-[28px]">
                {/* Team badge */}
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center font-header text-xs shrink-0"
                  style={{
                    background: player ? `${color}18` : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${player ? `${color}66` : 'rgba(255,255,255,0.10)'}`,
                    color: player ? color : 'rgba(255,255,255,0.20)',
                  }}
                >
                  {label}
                </div>
                <div className="flex-1 min-w-0">
                  {player ? (
                    <>
                      <p className="font-body text-white text-xs font-semibold leading-tight truncate">
                        {player.name}
                        {isMe && <span className="text-[10px] ml-1" style={{ color }}>(tú)</span>}
                      </p>
                      <p className="font-body text-white/30 text-[10px] leading-tight">
                        {player.isBot ? 'Bot' : !player.connected ? 'Reconectando…' : seatLabels[seatIndex]}
                        {isHost && player.isBot && (
                          <button
                            onClick={(e) => { e.stopPropagation(); socket.emit('room:remove_bot', { seatIndex }) }}
                            className="ml-2 text-accent/60 hover:text-accent text-[10px] transition-colors"
                          >
                            quitar
                          </button>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="font-body text-white/20 text-xs">Libre</p>
                  )}
                </div>
                {player && !player.isBot && (
                  inCallAt(seatIndex) ? (
                    <span
                      className="shrink-0"
                      style={{ color: (isMe ? myMicMuted : mutedPeers[seatIndex]) ? 'rgba(248,113,113,0.9)' : '#F5C518' }}
                      title={(isMe ? myMicMuted : mutedPeers[seatIndex]) ? 'Mic apagado' : 'En la llamada'}
                    >
                      <StrokeIcon><MicIcon muted={!!(isMe ? myMicMuted : mutedPeers[seatIndex])} /></StrokeIcon>
                    </span>
                  ) : (
                    <span className="shrink-0 text-white/25" title="Fuera de la llamada">
                      <StrokeIcon><MicIcon muted /></StrokeIcon>
                    </span>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Call: join it here, before the first game */}
      <LobbyCallBar peopleInCall={peopleInCall} />

      {/* Teams legend / mode indicator */}
      <div className="flex flex-col items-center gap-1.5 text-xs font-body">
        {is2PlayerLobby ? (
          <span className="text-white/50">Modo 2 jugadores (individual)</span>
        ) : (
          <div className="flex justify-center gap-6">
            <span style={{ color: '#22C55E' }}>● Equipo A: asientos 0 + 2</span>
            <span style={{ color: '#F97316' }}>● Equipo B: asientos 1 + 3</span>
          </div>
        )}
        {isHost && playerCount >= 2 && !is2PlayerLobby && (
          <p className="text-white/30 text-[11px]">
            {selectedSeat !== null
              ? 'Toca otro jugador para intercambiar'
              : 'Toca un jugador para cambiar equipos'}
          </p>
        )}
      </div>

      {/* Invite friends */}
      {isAuthenticated && room.players.length < 4 && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="w-full font-body text-sm py-2.5 rounded-xl text-white/70 hover:text-white transition-all btn-outline-shine"
          >
            {showInvite ? 'Cerrar' : 'Invitar Amigos'}
          </button>
          {showInvite && (
            <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto scrollbar-none">
              {friends.length === 0 ? (
                <p className="font-body text-white/30 text-xs text-center py-2">No tienes amigos agregados</p>
              ) : (
                friends.map((f: Friend) => {
                  const alreadyInRoom = room.players.some(p => p.userId === f.id)
                  const invited = invitedIds.has(f.id)
                  return (
                    <div key={f.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                      <p className="font-body text-white text-xs truncate flex-1">{f.displayName}</p>
                      {alreadyInRoom ? (
                        <span className="font-body text-green-400 text-[10px]">En sala</span>
                      ) : invited ? (
                        <span className="font-body text-white/40 text-[10px]">Enviado ✓</span>
                      ) : (
                        <button
                          onClick={() => sendInvite(f.id)}
                          className="font-body text-green-400 hover:text-green-300 text-xs font-bold transition-colors"
                        >
                          Invitar
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}

      <div className="gold-divider" />

      {/* Start / waiting */}
      {isHost ? (
        <div className="flex flex-col gap-2">
          {!canStart && (
            <p className="font-body text-white/40 text-sm text-center">
              {playerCount === 3
                ? 'Se necesitan 2 o 4 jugadores para iniciar'
                : playerCount < 2
                ? `Esperando ${2 - playerCount} jugador${2 - playerCount !== 1 ? 'es' : ''} más...`
                : `Esperando jugadores...`}
            </p>
          )}
          <GoldCTA onClick={startGame} disabled={!canStart} size="md">
            {canStart ? '¡INICIAR PARTIDA!' : `${playerCount} JUGADORES`}
          </GoldCTA>
        </div>
      ) : (
        <div className="text-center py-3">
          <p className="font-body text-white/40 text-sm">
            {canStart ? 'Esperando que el host inicie...' : `${playerCount} jugadores conectados`}
          </p>
        </div>
      )}
    </div>
  )
}
