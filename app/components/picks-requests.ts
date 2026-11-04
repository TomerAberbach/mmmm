import { useCallback, useRef, useState } from 'react'
import type { PicksRequest } from '~/picks-request.ts'

type Intent = PicksRequest[`intent`]

export type RequestState =
  | { kind: `idle` }
  | { kind: `sending`; intent: Intent }
  | { kind: `sent`; at: Date }
  | { kind: `failed`; intent: Intent; retry: () => void }
  // The server refused the request, so sending it again fails the same way
  | { kind: `refused`; intent: Intent }

type Queued = {
  request: PicksRequest
  // The request stays in flight until a returned promise settles
  onSent: () => void | Promise<void>
}

// Sends one request at a time, so they reach the server in order. A save waits
// behind the request in flight, and a newer request replaces any waiting save,
// since each request carries the whole set of picks or replaces it
export const usePicksRequests = (
  path: string,
): {
  state: RequestState
  send: (request: PicksRequest, onSent?: () => void | Promise<void>) => void
} => {
  const [state, setState] = useState<RequestState>({ kind: `idle` })
  const isSending = useRef(false)
  const waiting = useRef<Queued[]>([])

  const send = useCallback(
    (
      request: PicksRequest,
      onSent: () => void | Promise<void> = ignore,
    ): void => {
      const sendNow = (queued: Queued): void => {
        const { intent } = queued.request
        isSending.current = true
        setState(previous =>
          keepsFailure(previous, intent)
            ? previous
            : { kind: `sending`, intent },
        )
        void postRequest(path, queued.request)
          .then(async outcome => {
            if (outcome === `sent`) {
              // The request reached the server even when what follows fails
              await Promise.resolve(queued.onSent()).catch(ignore)
              setState(previous =>
                keepsFailure(previous, intent)
                  ? previous
                  : { kind: `sent`, at: new Date() },
              )
            } else if (outcome === `refused`) {
              setState({ kind: `refused`, intent })
            } else {
              setState({ kind: `failed`, intent, retry: () => sendNow(queued) })
            }
          })
          .finally(() => {
            isSending.current = false
            const next = waiting.current.shift()
            if (next) {
              sendNow(next)
            }
          })
      }
      const queued = { request, onSent }
      if (isSending.current) {
        waiting.current = [
          ...waiting.current.filter(({ request }) => request.intent !== `save`),
          queued,
        ]
      } else {
        sendNow(queued)
      }
    },
    [path],
  )
  return { state, send }
}

const ignore = () => {}

// A failed submit or discard stays shown past later saves, since a save doesn't
// do what the player asked
const keepsFailure = (previous: RequestState, intent: Intent): boolean =>
  previous.kind === `failed` && previous.intent !== `save` && intent === `save`

// A redirect means the server no longer remembers the player, and a 4xx that
// the bracket changed since the page loaded. Reloading resolves both, while a
// network error or a 5xx may pass on a retry
const postRequest = async (
  path: string,
  request: PicksRequest,
): Promise<`sent` | `refused` | `failed`> => {
  try {
    const response = await fetch(path, {
      method: `POST`,
      // Following the redirect would end at a page that answers 200
      redirect: `manual`,
      headers: { 'Content-Type': `application/json` },
      body: JSON.stringify(request),
    })
    if (response.ok) {
      return `sent`
    }
    return response.type === `opaqueredirect` || response.status < 500
      ? `refused`
      : `failed`
  } catch {
    return `failed`
  }
}
