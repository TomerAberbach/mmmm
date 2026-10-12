import { APIError } from 'better-auth/api'
import { ipKeyGenerator } from 'express-rate-limit'
import { RateLimiterMemory } from 'rate-limiter-flexible'
import { CLIENT_IP_HEADER } from './client-ip.ts'
import { normalizeEmail, tryConsume } from './limits.server.ts'

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
  const counted: Counted[] = []
  for (const entry of readCounted(request)) {
    const refusal = await tryConsume(entry.limiter, entry.key)
    if (refusal) {
      await Promise.all(counted.map(refund))
      throw tooManyAttempts(refusal.msBeforeNext)
    }
    counted.push(entry)
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

type Counted = { limiter: RateLimiterMemory; key: string }

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

// Without the header, every request would share one IP address's count, so a
// call that forgets to pass the request's headers fails instead. IPv6
// addresses count per /56 network, as the app-wide limit does
const readClientIp = (headers: Headers | undefined): string => {
  const ip = headers?.get(CLIENT_IP_HEADER)
  if (!ip) {
    throw new Error(
      `Pass the request's headers to Better Auth, so its limits can count the client's IP address`,
    )
  }
  return ipKeyGenerator(ip)
}

// Rewarding a key whose window has ended would start a new window with an
// extra attempt
const refund = async ({ limiter, key }: Counted): Promise<void> => {
  const counts = await limiter.get(key)
  if (counts && counts.consumedPoints > 0) {
    await limiter.reward(key, 1)
  }
}

const tooManyAttempts = (msBeforeNext: number): APIError => {
  const minutes = Math.max(1, Math.ceil(msBeforeNext / 60_000))
  return new APIError(
    `TOO_MANY_REQUESTS`,
    {
      code: TOO_MANY_ATTEMPTS,
      message: `Too many attempts. Try again in ${minutes} ${minutes === 1 ? `minute` : `minutes`}.`,
    },
    { 'Retry-After': String(Math.ceil(msBeforeNext / 1000)) },
  )
}
