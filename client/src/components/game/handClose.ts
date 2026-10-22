/**
 * Who closed a hand or a game, as the table would say it: "Trancó Bebo",
 * "Dominaste", "Terminó con el pase de Cuco". Null when the server did not say.
 */
export function closedByLine(
  reason: 'played_out' | 'blocked' | 'passes' | undefined,
  closedByIndex: number | undefined,
  players: { name: string }[],
  myPlayerIndex: number | null
): string | null {
  if (reason === undefined || closedByIndex === undefined) return null
  const me = closedByIndex === myPlayerIndex
  const name = players[closedByIndex]?.name ?? ''
  if (!me && !name) return null
  switch (reason) {
    case 'blocked': return me ? 'Trancaste' : `Trancó ${name}`
    case 'played_out': return me ? 'Dominaste' : `Dominó ${name}`
    case 'passes': return me ? 'Terminó con tu pase' : `Terminó con el pase de ${name}`
  }
}
