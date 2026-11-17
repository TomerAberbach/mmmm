import { APIError } from 'better-auth/api'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import {
  consumeAll,
  normalizeEmail,
  readClientIp,
  refund,
  toRefusal,
} from './limits.server.ts'
import type { Counted } from './limits.server.ts'

export const TOO_MANY_ATTEMPTS = `TOO_MANY_ATTEMPTS`

// Matches the error `limitAuthRequest` throws
export const isTooManyAttempts = (
  error: unknown,
): error is APIError & { body: { message: string } } =>
  error instanceof APIError && error.body?.code === TOO_MANY_ATTEMPTS

const MINUTE = 60
const HOUR = 60 * MINUTE

type Key = `ip` | `emailAndIp`
type Rule = { key: Key; points: number; duration: number }

// Addresses count per IP address too, never alone, so strangers can't lock an
// educator out from their own IP addresses. IP addresses get many attempts,
// because a whole school can share one. `sendEmail` caps the email each
// address receives, however many IP addresses ask
const EMAIL_SENDING_RULES: Rule[] = [
  { key: `emailAndIp`, points: 3, duration: HOUR },
  { key: `ip`, points: 100, duration: HOUR },
]

// `refundsSuccess` gives a successful request its attempts back, so only
// failures count and a school signing in together never runs out
const RULES: Record<string, { rules: Rule[]; refundsSuccess?: true }> = {
  '/sign-in/email': {
    rules: [
      { key: `emailAndIp`, points: 10, duration: 15 * MINUTE },
      { key: `ip`, points: 100, duration: 15 * MINUTE },
    ],
    refundsSuccess: true,
  },
  '/sign-up/email': { rules: EMAIL_SENDING_RULES },
  '/request-password-reset': { rules: EMAIL_SENDING_RULES },
  '/send-verification-email': { rules: EMAIL_SENDING_RULES },
}

// Counts stay in memory only, so no IP address is ever stored
const LIMITERS = new Map(
  Object.entries(RULES).map(([path, { rules, refundsSuccess = false }]) => [
    path,
    {
      refundsSuccess,
      limiters: rules.map(({ key, points, duration }) => ({
        key,
        limiter: new RateLimiterMemory({
          keyPrefix: `${path}:${key}`,
          points,
          duration,
        }),
      })),
    },
  ]),
)

type AuthRequest = {
  path: string
  email: unknown
  headers: Headers | undefined
}

// Throws once the address or the client's IP address has used up its attempts
// on the path, and then counts nothing, so a refused request costs no rule an
// attempt. A path without limits passes
export const limitAuthRequest = async (request: AuthRequest): Promise<void> => {
  const refusal = await consumeAll(readCounted(request))
  if (refusal) {
    const { message, headers } = toRefusal(
      refusal,
      wait => `Too many attempts. ${wait}.`,
    )
    throw new APIError(
      `TOO_MANY_REQUESTS`,
      { code: TOO_MANY_ATTEMPTS, message },
      headers,
    )
  }
}

// Gives back the attempts a successful request spent, on the paths whose
// rules refund success
export const refundAuthRequest = async (
  request: AuthRequest,
): Promise<void> => {
  if (LIMITERS.get(request.path)?.refundsSuccess) {
    await Promise.all(readCounted(request).map(refund))
  }
}

const readCounted = ({ path, email, headers }: AuthRequest): Counted[] => {
  const limiters = LIMITERS.get(path)?.limiters
  if (!limiters) {
    return []
  }
  const keys = readKeys(email, readClientIp(headers))
  const counted: Counted[] = []
  for (const { key, limiter } of limiters) {
    const value = keys[key]
    if (value !== undefined) {
      counted.push({ limiter, key: value })
    }
  }
  return counted
}

const readKeys = (
  email: unknown,
  ip: string,
): Record<Key, string | undefined> => ({
  ip,
  emailAndIp:
    typeof email === `string` ? `${normalizeEmail(email)} ${ip}` : undefined,
})
