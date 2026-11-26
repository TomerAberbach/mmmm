import { useCallback, useRef, useState } from 'react'
import { LOCKED_STATUS } from '~/submissions-locked.ts'

export type RequestState<Sent> =
  | { kind: `idle` }
  | { kind: `sending`; request: Sent }
  | { kind: `sent`; at: Date }
  | { kind: `failed`; request: Sent }
  // The year locked before the request arrived
  | { kind: `locked`; request: Sent }
  // The server refused the request, so sending it again fails the same way
  | { kind: `refused`; request: Sent }

type Queued<Sent> = {
  request: Sent
  /** The request stays in flight until a returned promise settles */
  onSent: () => void | Promise<void>
}

/** How a queue's requests affect each other. Define it outside the component */
export type QueueRules<Sent> = {
  /** Whether a newer request makes the waiting one unneeded */
  isReplaceable: (waiting: Sent) => boolean
  /** Whether a failed request stays shown past the next one */
  keepsFailure: (failed: Sent, next: Sent) => boolean
}

/**
 * Sends one request at a time, so they reach the server in order. A request
 * waits behind the one in flight
 */
export const useRequestQueue = <Sent>(
  path: string,
  rules?: QueueRules<Sent>,
): {
  state: RequestState<Sent>
  /** Whether any request is in flight, which a failed state doesn't show */
  isSending: boolean
  send: (request: Sent, onSent?: () => void | Promise<void>) => void
} => {
  const [state, setState] = useState<RequestState<Sent>>({ kind: `idle` })
  const [isSending, setIsSending] = useState(false)
  const isInFlight = useRef(false)
  const waiting = useRef<Queued<Sent>[]>([])

  const send = useCallback(
    (request: Sent, onSent: () => void | Promise<void> = ignore): void => {
      const sendNow = (queued: Queued<Sent>): void => {
        const { request: sent } = queued
        const setStateUnlessKept = (next: RequestState<Sent>): void =>
          setState(previous =>
            previous.kind === `failed` &&
            rules?.keepsFailure(previous.request, sent)
              ? previous
              : next,
          )
        isInFlight.current = true
        setIsSending(true)
        setStateUnlessKept({ kind: `sending`, request: sent })
        void postRequest(path, sent)
          .then(async outcome => {
            if (outcome === `sent`) {
              // The request reached the server even when what follows fails
              await Promise.resolve(queued.onSent()).catch(ignore)
              setStateUnlessKept({ kind: `sent`, at: new Date() })
            } else if (outcome === `failed`) {
              setStateUnlessKept({ kind: `failed`, request: sent })
            } else {
              setState({ kind: outcome, request: sent })
            }
          })
          .finally(() => {
            isInFlight.current = false
            const next = waiting.current.shift()
            if (next) {
              sendNow(next)
            } else {
              setIsSending(false)
            }
          })
      }
      const queued = { request, onSent }
      if (isInFlight.current) {
        waiting.current = [
          ...waiting.current.filter(
            other => !rules?.isReplaceable(other.request),
          ),
          queued,
        ]
      } else {
        sendNow(queued)
      }
    },
    [path, rules],
  )
  return { state, isSending, send }
}

const ignore = () => {}

/**
 * A redirect means the server no longer remembers who sent it, and a 4xx other
 * than a 429 that the bracket changed since the page loaded. Reloading resolves
 * both
 */
const postRequest = async (
  path: string,
  request: unknown,
): Promise<`sent` | `refused` | `locked` | `failed`> => {
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
    if (response.status === LOCKED_STATUS) {
      return `locked`
    }
    return canPass(response) ? `failed` : `refused`
  } catch {
    return `failed`
  }
}

/** Whether the same request may succeed later, as after a busy minute */
const canPass = ({ type, status }: Response): boolean =>
  type !== `opaqueredirect` && (status >= 500 || status === TOO_MANY_REQUESTS)

const TOO_MANY_REQUESTS = 429
