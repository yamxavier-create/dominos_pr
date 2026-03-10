import { useState } from 'react'
import { useRoomStore } from '../../store/roomStore'
import { useGameActions } from '../../hooks/useGameActions'
import { socket } from '../../socket'
import { useCallStore } from '../../store/callStore'

const teamColors = ['#22C55E', '#F97316', '#22C55E', '#F97316']
const seatLabels = ['Host', 'Jugador 2', 'Jugador 3', 'Jugador 4']
const teamLabels = ['A', 'B', 'A', 'B']

export function RoomLobby() {
  const room = useRoomStore(s => s.room)
  const roomCode = useRoomStore(s => s.roomCode)
  const myPlayerIndex = useRoomStore(s => s.myPlayerIndex)
  const { startGame } = useGameActions()
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)
  const myAudioEnabled = useCallStore(s => s.myAudioEnabled)
  const myVideoEnabled = useCallStore(s => s.myVideoEnabled)
  const lobbyOpts = useCallStore(s => s.lobbyOpts)

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
  const canStart = playerCount === 4

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
    <div className="flex flex-col gap-5 w-full max-w-sm">
      {/* Room code card */}
      <div
        className="text-center rounded-2xl p-6"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        <p className="font-body text-white/40 text-xs uppercase tracking-widest mb-2">Código de Sala</p>
        <p className="font-header text-4xl text-gold tracking-wider">{room.roomCode}</p>
        <p className="font-body text-white/40 text-xs mt-2">
          Modo: <span style={{ color: '#22C55E' }}>{room.gameMode === 'modo200' ? 'Modo 200 (20 pts)' : 'Modo 500'}</span>
        </p>
      </div>

      {/* Players grid */}
      <div className="grid grid-cols-2 gap-2">
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
              className={`rounded-xl p-3 transition-all ${isHost && player ? 'cursor-pointer' : ''}`}
              style={{
                background: isSelected
                  ? 'rgba(255,255,255,0.12)'
                  : player ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                border: isSelected
                  ? '1.5px solid #facc15'
                  : isSwapTarget
                  ? '1.5px dashed rgba(250,204,21,0.5)'
                  : isMe
                  ? `1.5px solid ${color}`
                  : player
                  ? '1px solid rgba(255,255,255,0.10)'
                  : '1px dashed rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-2">
                {/* Team avatar */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center font-header text-sm shrink-0"
                  style={{
                    background: player ? `${color}22` : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${player ? color : 'rgba(255,255,255,0.12)'}`,
                    color: player ? color : 'rgba(255,255,255,0.25)',
                  }}
                >
                  {label}
                </div>
                <div className="flex-1 min-w-0">
                  {player ? (
                    <>
                      <p className="font-body text-white text-sm truncate font-semibold">
                        {player.name}{isMe && <span className="text-xs ml-1" style={{ color }}>  (tú)</span>}
                      </p>
                      <p className="font-body text-white/35 text-xs">{seatLabels[seatIndex]}</p>
                    </>
                  ) : (
                    <p className="font-body text-white/25 text-sm italic">Esperando...</p>
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

      {/* Teams legend */}
      <div className="flex flex-col items-center gap-1.5 text-xs font-body">
        <div className="flex justify-center gap-6">
          <span style={{ color: '#22C55E' }}>● Equipo A: asientos 0 + 2</span>
          <span style={{ color: '#F97316' }}>● Equipo B: asientos 1 + 3</span>
        </div>
        {isHost && playerCount >= 2 && (
          <p className="text-white/30 text-[11px]">
            {selectedSeat !== null
              ? 'Toca otro jugador para intercambiar'
              : 'Toca un jugador para cambiar equipos'}
          </p>
        )}
      </div>

      {/* Start / waiting */}
      {isHost ? (
        <div className="flex flex-col gap-2">
          {!canStart && (
            <p className="font-body text-white/40 text-sm text-center">
              Esperando {4 - playerCount} jugador{4 - playerCount !== 1 ? 'es' : ''} más...
            </p>
          )}
          <button
            onClick={startGame}
            disabled={!canStart}
            className="w-full font-body font-bold py-3.5 rounded-2xl text-white text-base transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}
          >
            {canStart ? '¡Iniciar Partida!' : `${playerCount}/4 jugadores`}
          </button>
        </div>
      ) : (
        <div
          className="text-center rounded-xl py-4"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <p className="font-body text-white/40 text-sm">
            {canStart ? 'Esperando que el host inicie...' : `${playerCount}/4 jugadores conectados`}
          </p>
        </div>
      )}
    </div>
  )
}
