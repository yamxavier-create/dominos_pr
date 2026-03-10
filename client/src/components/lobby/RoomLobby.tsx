import { useState } from 'react'
import { useRoomStore } from '../../store/roomStore'
import { useGameActions } from '../../hooks/useGameActions'
import { socket } from '../../socket'

const teamColors = ['#22C55E', '#F97316', '#22C55E', '#F97316']
const seatLabels = ['Host', 'Jugador 2', 'Jugador 3', 'Jugador 4']
const teamLabels = ['A', 'B', 'A', 'B']

export function RoomLobby() {
  const room = useRoomStore(s => s.room)
  const myPlayerIndex = useRoomStore(s => s.myPlayerIndex)
  const { startGame } = useGameActions()
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null)

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
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
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
