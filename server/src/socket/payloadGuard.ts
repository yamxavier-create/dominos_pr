import { Socket } from 'socket.io'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Harden a socket against malformed client payloads. Call once per connection,
 * before registering any handler.
 *
 * 1. Every client event's first argument is normalized to a plain object, so
 *    handlers that destructure `({ roomCode })` never throw on null, a missing
 *    payload, a primitive or an array. Handlers still check field types.
 * 2. Every listener is wrapped so a sync throw or a rejected promise is logged
 *    instead of becoming an uncaught exception that kills the process and every
 *    in-memory game with it.
 */
export function guardSocket(socket: Socket): void {
  socket.use((packet, next) => {
    // packet = [eventName, ...args]; a trailing ack callback stays in place
    const payload = packet[1]
    if (typeof payload === 'function') {
      packet.splice(1, 0, {})
    } else if (!isPlainObject(payload)) {
      packet[1] = {}
    }
    next()
  })

  const on = socket.on.bind(socket)
  socket.on = ((event: string, listener: (...args: unknown[]) => unknown) =>
    on(event, (...args: unknown[]) => {
      const fail = (err: unknown) =>
        console.error(`[socket] handler "${event}" failed for ${socket.id}:`, err)
      try {
        const result = listener(...args)
        if (result instanceof Promise) result.catch(fail)
      } catch (err) {
        fail(err)
      }
    })) as Socket['on']
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
