/**
 * Delayed full reconnections for failed peer connections. A timer only fires
 * if the call session is still active and the connection that failed is still
 * the current one for that peer, so it can't resurrect a call after leaving or
 * close a healthy connection that already replaced the failed one.
 */
export interface ReconnectSchedulerDeps<PC> {
  isActive(): boolean
  currentPc(peer: number): PC | undefined
  reconnect(peer: number): void
}

export function createReconnectScheduler<PC>(deps: ReconnectSchedulerDeps<PC>) {
  const timers = new Map<number, ReturnType<typeof setTimeout>>()

  const cancel = (peer: number) => {
    const t = timers.get(peer)
    if (t !== undefined) clearTimeout(t)
    timers.delete(peer)
  }

  return {
    schedule(peer: number, failedPc: PC, delayMs: number) {
      cancel(peer)
      timers.set(peer, setTimeout(() => {
        timers.delete(peer)
        if (!deps.isActive() || deps.currentPc(peer) !== failedPc) return
        deps.reconnect(peer)
      }, delayMs))
    },
    cancel,
    cancelAll() {
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
    },
    pending(): number {
      return timers.size
    },
  }
}
