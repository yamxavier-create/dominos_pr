import { useState, useEffect, useRef } from 'react'
import { useRoomStore } from '../../store/roomStore'
import { useGameActions } from '../../hooks/useGameActions'
import { socket } from '../../socket'
import { useCallStore } from '../../store/callStore'
import { useAuthStore } from '../../store/authStore'
import { useSocialStore, Friend } from '../../store/socialStore'
import { API_BASE } from '../../apiBase'
import { GoldCTA, GoldCaption } from '../ui/GoldCTA'
import { ChunkyButton, GoldPlate } from '../ui/Escenario'
import { joinCallRef } from '../../hooks/useWebRTC'
import { useVideoStream } from '../player/AvatarVideo'
import { useCallToggles, MicIcon, CameraIcon } from '../player/CallControls'
import { RulesModal } from './RulesModal'
import { MODE_NAMES, RULE_KEYS, RULE_OPTIONS, editableRules, ruleValueLabel } from '../../rules'

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
        background: `radial-gradient(circle at 50% 35%, ${color}66, ${color}22 80%)`,
        border: '2px solid #06140B',
        boxShadow: speaking ? `0 0 0 2px #FDD04B, 0 0 14px rgba(253,208,75,0.45)` : 'inset 0 3px 0 rgba(0,0,0,0.3)',
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
        <div className="w-full h-full flex items-center justify-center font-chunky text-4xl mm-stroke">
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
        <ChunkyButton tone="green" size="sm" onClick={joinCall} disabled={joining} className="py-0.5">
          <StrokeIcon className="w-5 h-5"><path d="M3 7h11v10H3z" /><path d="M14 10.5l7-3.5v10l-7-3.5" /></StrokeIcon>
          <span className="text-lg">{joining ? 'Conectando…' : 'Unirse a la llamada'}</span>
        </ChunkyButton>
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
      className="mm-press w-12 h-12 rounded-full flex items-center justify-center"
      style={{
        background: off ? 'linear-gradient(180deg, #E5534A, #8E2A22)' : 'linear-gradient(180deg, #2E9A57, #124E2B)',
        border: '2px solid #06140B',
        boxShadow: '0 4px 0 #06140B, inset 0 2px 0 rgba(255,255,255,0.2)',
        color: off ? '#fff' : '#FDD04B',
      }}
    >
      <StrokeIcon className="w-5 h-5">{icon}</StrokeIcon>
    </button>
  )

  return (
    <div className="flex items-center justify-center gap-3">
      {toggle(micMuted ? 'Activar mic' : 'Silenciar mic', micMuted, toggleMic, <MicIcon muted={micMuted} />)}
      {toggle(cameraOff ? 'Activar camara' : 'Apagar camara', cameraOff, toggleCamera, <CameraIcon off={cameraOff} />)}
      <span className="font-body font-extrabold text-xs text-white/80">
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
  const [showRules, setShowRules] = useState(false)
  // The host sees the rules once when a room opens, before anyone starts
  const rulesShownFor = useRef<string | null>(null)
  const hostOfNewRoom = myPlayerIndex === 0 && room?.status === 'waiting' && room.players.length === 1
  useEffect(() => {
    if (!room || !hostOfNewRoom || rulesShownFor.current === room.roomCode) return
    rulesShownFor.current = room.roomCode
    if (editableRules(room.gameMode).length > 0) setShowRules(true)
  }, [room?.roomCode, hostOfNewRoom])
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
      {/* Room code: the name plate of this table */}
      <div className="mm-pop flex flex-col items-center gap-1.5 py-1">
        <GoldCaption>Código de sala</GoldCaption>
        <GoldPlate className="min-w-[78%]">
          <p className="font-chunky text-[2.4rem] leading-none mm-stroke tracking-[0.08em] select-all">{room.roomCode}</p>
        </GoldPlate>
        <p className="font-body font-extrabold text-white/80 text-xs mt-1">
          {room.gameMode === 'modo200' ? 'Modo 200 · Hasta 20 pts' : MODE_NAMES[room.gameMode]}
        </p>
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
                  boxShadow: '0 0 0 3px #FDD04B, 0 0 18px rgba(253,208,75,0.5), 0 5px 0 #06140B',
                } : isSwapTarget ? {
                  boxShadow: '0 0 0 2px rgba(253,208,75,0.7), 0 5px 0 #06140B',
                } : isMe ? {
                  boxShadow: '0 0 0 2px #EAB308, 0 5px 0 #06140B, inset 0 2px 0 rgba(255,255,255,0.08)',
                } : {}),
              }}
            >
              {player && !player.isBot ? (
                <SeatVideo seatIndex={seatIndex} name={player.name} isMe={isMe} color={color} />
              ) : (
                <div
                  className="w-full aspect-[4/3] rounded-[10px] flex items-center justify-center px-2"
                  style={{ background: player?.isBot ? 'rgba(6,20,11,0.5)' : undefined }}
                >
                  {player?.isBot ? (
                    <span className="text-3xl opacity-60" aria-hidden>🤖</span>
                  ) : isHost ? (
                    <span onClick={(e) => e.stopPropagation()} className="w-full">
                      <ChunkyButton tone="green" size="sm" onClick={() => socket.emit('room:add_bot')}>+ Bot</ChunkyButton>
                    </span>
                  ) : (
                    <p className="font-body font-bold text-white/50 text-xs">
                      Esperando <WaitingDots />
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2 min-h-[28px]">
                {/* Team badge */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center font-chunky text-sm shrink-0"
                  style={{
                    background: player ? color : 'rgba(255,255,255,0.06)',
                    border: '2px solid #06140B',
                    boxShadow: player ? '0 2px 0 #06140B, inset 0 2px 0 rgba(255,255,255,0.3)' : undefined,
                    color: player ? '#06140B' : 'rgba(255,255,255,0.35)',
                  }}
                >
                  {label}
                </div>
                <div className="flex-1 min-w-0">
                  {player ? (
                    <>
                      <p className="font-chunky text-white text-[15px] leading-tight truncate tracking-wide">
                        {player.name}
                        {isMe && <span className="text-[10px] ml-1" style={{ color }}>(tú)</span>}
                      </p>
                      <p className="font-body font-bold text-white/55 text-[11px] leading-tight">
                        {player.isBot ? 'Bot' : !player.connected ? 'Reconectando…' : seatLabels[seatIndex]}
                        {isHost && player.isBot && (
                          <button
                            onClick={(e) => { e.stopPropagation(); socket.emit('room:remove_bot', { seatIndex }) }}
                            className="ml-2 font-extrabold text-[#FF8A80] text-[11px] transition-colors"
                          >
                            quitar
                          </button>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="font-body font-bold text-white/40 text-xs">Libre</p>
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
      <div className="flex flex-col items-center gap-1.5 text-xs font-body font-bold">
        {is2PlayerLobby ? (
          <span className="text-white/70">Modo 2 jugadores (individual)</span>
        ) : (
          <div className="flex justify-center gap-6">
            <span style={{ color: '#22C55E' }}>● Equipo A: asientos 0 + 2</span>
            <span style={{ color: '#F97316' }}>● Equipo B: asientos 1 + 3</span>
          </div>
        )}
        {isHost && playerCount >= 2 && !is2PlayerLobby && (
          <p className="text-white/55 text-[11px]">
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
            className="w-full font-chunky text-lg tracking-wide py-2 rounded-xl mm-stroke btn-outline-shine"
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
                    <div key={f.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(6,20,11,0.55)', border: '2px solid #06140B' }}>
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

      {/* House rules: the host changes them, everyone can read them */}
      {room.rules && (
        <button
          onClick={() => setShowRules(true)}
          className="w-full rounded-xl px-3 py-2.5 text-left transition-all btn-outline-shine flex items-center gap-3"
        >
          <span className="flex-1 min-w-0">
            <span className="block font-chunky text-white text-base tracking-wide mm-stroke">Reglas de la mesa</span>
            <span className="block font-body font-bold text-white/65 text-xs truncate">
              {room.gameMode === 'torneo'
                ? 'Reglas oficiales del torneo'
                : RULE_KEYS.filter(key => editableRules(room.gameMode).includes(key))
                    .map(key => `${RULE_OPTIONS[key].title}: ${ruleValueLabel(key, room.rules[key]).toLowerCase()}`)
                    .join(' · ')}
            </span>
          </span>
          <span className="font-chunky text-[#FDD04B] text-sm shrink-0 mm-stroke !text-[#FDD04B]">
            {isHost && editableRules(room.gameMode).length > 0 ? 'Cambiar' : 'Ver'}
          </span>
        </button>
      )}

      {showRules && room.rules && (
        <RulesModal
          gameMode={room.gameMode}
          rules={room.rules}
          canEdit={isHost && room.status === 'waiting'}
          onClose={() => setShowRules(false)}
        />
      )}

      <div className="gold-divider" />

      {/* Start / waiting: pinned to the bottom of the screen so it never scrolls out of sight */}
      <div
        className="sticky bottom-0 z-10 -mx-4 px-4 pt-4"
        style={{
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
          background: 'linear-gradient(180deg, rgba(10,26,15,0) 0%, rgba(10,26,15,0.92) 28%, #0A1A0F 100%)',
        }}
      >
      {isHost ? (
        <div className="flex flex-col gap-2">
          {!canStart && (
            <p className="font-body font-bold text-white/70 text-sm text-center">
              {playerCount === 3
                ? 'Se necesitan 2 o 4 jugadores para iniciar'
                : playerCount < 2
                ? `Esperando ${2 - playerCount} jugador${2 - playerCount !== 1 ? 'es' : ''} más...`
                : `Esperando jugadores...`}
            </p>
          )}
          <GoldCTA onClick={startGame} disabled={!canStart} size="md">
            {canStart ? '¡INICIAR PARTIDA!' : `${playerCount} ${playerCount === 1 ? 'JUGADOR' : 'JUGADORES'}`}
          </GoldCTA>
        </div>
      ) : (
        <div className="text-center py-3">
          <p className="font-body font-bold text-white/70 text-sm">
            {canStart ? 'Esperando que el host inicie...' : `${playerCount} jugadores conectados`}
          </p>
        </div>
      )}
      </div>
    </div>
  )
}
