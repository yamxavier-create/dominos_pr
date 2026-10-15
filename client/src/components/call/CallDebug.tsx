import { useEffect, useState } from 'react'
import { peerConnectionsRef } from '../../hooks/useWebRTC'
import { useCallStore } from '../../store/callStore'

const FLAG = 'debug_call'
const LOG_MAX = 40
const callLog: string[] = []
const t0 = Date.now()

/** Mirror every [WebRTC] console line into a ring buffer the overlay shows. */
function captureCallLog() {
  for (const level of ['log', 'warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      const first = args[0]
      if (typeof first === 'string' && first.startsWith('[WebRTC]')) {
        const text = args.map(a => typeof a === 'string' ? a : a instanceof Error ? a.message : String(a)).join(' ')
        callLog.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${level === 'log' ? '' : level + ' '}${text.slice(9)}`)
        if (callLog.length > LOG_MAX) callLog.shift()
      }
    }
  }
}

/** On with ?debug=call, off with ?debug=off; remembered so it survives the home-screen app. */
export function callDebugEnabled(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('debug')
    if (q === 'call') localStorage.setItem(FLAG, '1')
    if (q === 'off') localStorage.removeItem(FLAG)
    const on = localStorage.getItem(FLAG) === '1'
    if (on) captureCallLog()
    return on
  } catch {
    return false
  }
}

const kb = (n: unknown) => typeof n === 'number' ? `${Math.round(n / 1024)}KB` : '-'

async function describePeer(seat: number, pc: RTCPeerConnection, stream: MediaStream | null): Promise<string[]> {
  const lines = [`#${seat} ${pc.connectionState} ice=${pc.iceConnectionState} sig=${pc.signalingState}`]
  const stats = await pc.getStats()
  const byId = new Map<string, any>()
  stats.forEach((r: any) => byId.set(r.id, r))
  const pairStates: Record<string, number> = {}
  let localCands = 0, remoteCands = 0
  stats.forEach((r: any) => {
    if (r.type === 'candidate-pair') pairStates[r.state] = (pairStates[r.state] ?? 0) + 1
    if (r.type === 'local-candidate') localCands++
    if (r.type === 'remote-candidate') remoteCands++
  })
  lines.push(`  cands local=${localCands} remote=${remoteCands} pairs ${Object.entries(pairStates).map(([k, v]) => `${k}:${v}`).join(' ') || 'none'}`)
  stats.forEach((r: any) => {
    if (r.type === 'candidate-pair' && (r.nominated || r.selected) && r.state === 'succeeded') {
      const l = byId.get(r.localCandidateId), rem = byId.get(r.remoteCandidateId)
      lines.push(`  path ${l?.candidateType}/${l?.protocol} → ${rem?.candidateType} rtt=${r.currentRoundTripTime ?? '-'}`)
    }
    if (r.type === 'inbound-rtp' && r.kind === 'video') {
      const codec = byId.get(r.codecId)?.mimeType ?? '?'
      lines.push(`  in video ${codec} ${kb(r.bytesReceived)} dec=${r.framesDecoded ?? '-'} drop=${r.framesDropped ?? '-'} ${r.frameWidth ?? 0}x${r.frameHeight ?? 0} pli=${r.pliCount ?? '-'}`)
    }
    if (r.type === 'inbound-rtp' && r.kind === 'audio') lines.push(`  in audio ${kb(r.bytesReceived)}`)
    if (r.type === 'outbound-rtp' && r.kind === 'video') {
      const codec = byId.get(r.codecId)?.mimeType ?? '?'
      lines.push(`  out video ${codec} ${kb(r.bytesSent)} enc=${r.framesEncoded ?? '-'} ${r.frameWidth ?? 0}x${r.frameHeight ?? 0} lim=${r.qualityLimitationReason ?? '-'}`)
    }
    if (r.type === 'outbound-rtp' && r.kind === 'audio') lines.push(`  out audio ${kb(r.bytesSent)}`)
  })
  for (const t of stream?.getTracks() ?? []) {
    lines.push(`  track ${t.kind} ${t.readyState} muted=${t.muted} enabled=${t.enabled}`)
  }
  const recv = pc.getReceivers().map(r => `${r.track.kind}:${r.track.muted ? 'muted' : 'live'}`).join(' ')
  lines.push(`  receivers ${recv}`)
  return lines
}

/** WebRTC state per peer, refreshed every 2s, so a phone can show why a camera stays black. */
export function CallDebug() {
  const [text, setText] = useState('')
  const remoteStreams = useCallStore(s => s.remoteStreams)
  const localStream = useCallStore(s => s.localStream)

  useEffect(() => {
    let stop = false
    const tick = async () => {
      const lines: string[] = []
      for (const t of localStream?.getTracks() ?? []) lines.push(`local ${t.kind} ${t.readyState} muted=${t.muted} enabled=${t.enabled}`)
      for (const [seat, pc] of Object.entries(peerConnectionsRef.current())) {
        try {
          lines.push(...await describePeer(+seat, pc, remoteStreams[+seat] ?? null))
        } catch (e) {
          lines.push(`#${seat} stats error ${String(e)}`)
        }
      }
      document.querySelectorAll('video').forEach((v, i) => {
        const s = v.srcObject as MediaStream | null
        if (s) lines.push(`<video ${i}> ${v.videoWidth}x${v.videoHeight} paused=${v.paused} ready=${v.readyState} tracks=${s.getVideoTracks().length}`)
      })
      if (callLog.length) lines.push('— log —', ...callLog.slice(-25))
      if (!stop) setText(lines.join('\n') || 'sin peers')
    }
    tick()
    const id = setInterval(tick, 2000)
    return () => { stop = true; clearInterval(id) }
  }, [remoteStreams, localStream])

  return (
    <pre
      className="fixed left-1 z-[9999] max-w-[95vw] max-h-[70vh] overflow-auto p-1.5 rounded bg-black/80 text-[9px] leading-tight text-lime-300 pointer-events-auto select-text whitespace-pre-wrap"
      style={{ top: 'calc(48px + var(--safe-top, 0px))' }}
    >
      {text}
    </pre>
  )
}
