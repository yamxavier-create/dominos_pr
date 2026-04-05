import { useState, useEffect } from 'react'
import { useRoomStore } from '../../store/roomStore'
import { useGameActions } from '../../hooks/useGameActions'
import { socket } from '../../socket'
import { useCallStore } from '../../store/callStore'
import { useAuthStore } from '../../store/authStore'
import { useSocialStore, Friend } from '../../store/socialStore'
import { API_BASE } from '../../apiBase'

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

export function RoomLobby() {
  const room = useRoomStore(s => s.room)
  const roomCode = useRoomStore(s => s.roomCode)
  const myPlayerIndex = useRoomStore(s => s.myPlayerIndex)
  const { startGame } = useGameActions()
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set())
  const myAudioEnabled = useCallStore(s => s.myAudioEnabled)
  const myVideoEnabled = useCallStore(s => s.myVideoEnabled)
  const lobbyOpts = useCallStore(s => s.lobbyOpts)
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

  const handleToggleAudio = () => {
    const newAudio = !myAudioEnabled
    useCallStore.getState().setMyLobbyOpt(newAudio, myVideoEnabled)
    socket.emit('webrtc:lobby_opt', { roomCode, audio: newAudio, video: myVideoEnabled })
  }

  const handleToggleVideo = () => {
    const newVideo = !myVideoEnabled
    useCallStore.getState().setMyLobbyOpt(myAudioEnabled, newVideo)
    socket.emit('webrtc:lobby_opt', { roomCode, audio: myAudioEnabled, video: newVideo })
  }

  if (!room) return null

  const isHost = myPlayerIndex === 0
  const playerCount = room.players.filter(p => p.connected).length
  const canStart = playerCount === 2 || playerCount === 4
  const is2PlayerLobby = playerCount <= 2

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
    <div className="menu-card menu-reveal flex flex-col gap-5 w-full max-w-sm">
      {/* Room code card */}
      <div className="text-center py-5">
        <p className="font-body text-white/40 text-[10px] uppercase tracking-[0.25em] mb-3">Código de Sala</p>
        <p className="font-header text-5xl text-gold tracking-widest room-code-glow">{room.roomCode}</p>
        <p className="font-body text-white/40 text-xs mt-3">
          Modo: <span style={{ color: '#22C55E' }}>{room.gameMode === 'modo200' ? 'Modo 200 (20 pts)' : 'Modo 500'}</span>
        </p>
      </div>

      <div className="gold-divider" />

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
              className={`p-3.5 transition-all ${player ? 'seat-card' : 'seat-card-empty'} ${isHost && player ? 'cursor-pointer' : ''}`}
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
              <div className="flex items-center gap-2.5">
                {/* Team avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-header text-sm shrink-0"
                  style={{
                    background: player ? `${color}18` : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${player ? `${color}66` : 'rgba(255,255,255,0.10)'}`,
                    color: player ? color : 'rgba(255,255,255,0.20)',
                    boxShadow: player ? `0 0 8px ${color}20` : 'none',
                  }}
                >
                  {label}
                </div>
                <div className="flex-1 min-w-0">
                  {player ? (
                    <>
                      <p className="font-body text-white text-sm truncate font-semibold">
                        {player.name}
                        {isMe && <span className="text-xs ml-1" style={{ color }}>  (tú)</span>}
                        {player.isBot && <span className="text-xs ml-1 text-white/30">🤖</span>}
                      </p>
                      <p className="font-body text-white/30 text-[11px]">
                        {player.isBot ? 'Bot' : seatLabels[seatIndex]}
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
                  ) : isHost ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); socket.emit('room:add_bot') }}
                      className="font-body text-primary/50 hover:text-primary text-sm transition-colors"
                    >
                      + Añadir Bot
                    </button>
                  ) : (
                    <p className="font-body text-white/20 text-sm italic">
                      Esperando <WaitingDots />
                    </p>
                  )}
                </div>
                {player && (
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Mic icon */}
                    {isMe ? (
                      <button
                        onClick={e => { e.stopPropagation(); handleToggleAudio() }}
                        title={myAudioEnabled ? 'Micrófono activado' : 'Micrófono desactivado'}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 1 }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={myAudioEnabled ? '#F5C518' : 'rgba(255,255,255,0.3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                          {!myAudioEnabled && <line x1="4" y1="4" x2="20" y2="20" stroke="rgba(255,255,255,0.3)" />}
                        </svg>
                      </button>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={lobbyOpts[seatIndex]?.audio ? '#F5C518' : 'rgba(255,255,255,0.3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                        {!lobbyOpts[seatIndex]?.audio && <line x1="4" y1="4" x2="20" y2="20" stroke="rgba(255,255,255,0.3)" />}
                      </svg>
                    )}
                    {/* Camera icon */}
                    {isMe ? (
                      <button
                        onClick={e => { e.stopPropagation(); handleToggleVideo() }}
                        title={myVideoEnabled ? 'Cámara activada' : 'Cámara desactivada'}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 1 }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={myVideoEnabled ? '#F5C518' : 'rgba(255,255,255,0.3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="23 7 16 12 23 17 23 7" />
                          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                          {!myVideoEnabled && <line x1="4" y1="4" x2="20" y2="20" stroke="rgba(255,255,255,0.3)" />}
                        </svg>
                      </button>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={lobbyOpts[seatIndex]?.video ? '#F5C518' : 'rgba(255,255,255,0.3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        {!lobbyOpts[seatIndex]?.video && <line x1="4" y1="4" x2="20" y2="20" stroke="rgba(255,255,255,0.3)" />}
                      </svg>
                    )}
                    <span className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

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
          <button
            onClick={startGame}
            disabled={!canStart}
            className="w-full font-body font-bold py-3.5 rounded-2xl text-white text-base active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed btn-glow"
          >
            {canStart ? '¡Iniciar Partida!' : `${playerCount} jugadores`}
          </button>
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
