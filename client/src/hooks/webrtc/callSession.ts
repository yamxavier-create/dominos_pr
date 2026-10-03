/**
 * Every async step of the call (permission prompt, TURN fetch, track recovery)
 * captures the session id first and checks it after each await. Leaving the
 * game ends the session, so a late permission grant can't start a capture or
 * create peer connections after cleanup.
 */
export class CallSession {
  private id = 0
  private active = false

  /** Start a session (on mount). Returns its id. */
  begin(): number {
    this.active = true
    return ++this.id
  }

  /** End the current session (on cleanup). Every pending continuation becomes stale. */
  end() {
    this.active = false
    this.id++
  }

  current(): number {
    return this.id
  }

  isCurrent(id: number): boolean {
    return this.active && id === this.id
  }
}
