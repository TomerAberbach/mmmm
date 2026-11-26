import { RateLimiterMemory } from 'rate-limiter-flexible'
import { refuse } from './app-refusal.server.ts'
import {
  consumeAll,
  normalizeEmail,
  readClientIp,
  refund,
  toRefusal,
} from './limits.server.ts'
import type { Counted } from './limits.server.ts'

const MINUTE = 60
const HOUR = 60 * MINUTE

type Limit = {
  /** Attempts for each address from one IP address */
  perEmailAndIp: number
  perIp: number
  duration: number
  /**
   * Gives a successful request its attempts back, so only failures count and a
   * school signing in together never runs out
   */
  refundsSuccess?: true
}

/**
 * Addresses count per IP address too, never alone, so strangers can't lock an
 * educator out from their own IP addresses. IP addresses get many attempts,
 * because a whole school can share one. `sendEmail` caps the email each
 * address receives, however many IP addresses ask
 */
const EMAIL_SENDING_LIMIT: Limit = {
  perEmailAndIp: 3,
  perIp: 100,
  duration: HOUR,
}

const LIMITS: Record<string, Limit> = {
  '/sign-in/email': {
    perEmailAndIp: 10,
    perIp: 100,
    duration: 15 * MINUTE,
    refundsSuccess: true,
  },
  '/sign-up/email': EMAIL_SENDING_LIMIT,
  '/request-password-reset': EMAIL_SENDING_LIMIT,
  '/send-verification-email': EMAIL_SENDING_LIMIT,
}

/** Counts stay in memory only, so no IP address is ever stored */
const LIMITERS = new Map(
  Object.entries(LIMITS).map(
    ([path, { perEmailAndIp, perIp, duration, refundsSuccess = false }]) => [
      path,
      {
        refundsSuccess,
        emailAndIp: new RateLimiterMemory({ points: perEmailAndIp, duration }),
        ip: new RateLimiterMemory({ points: perIp, duration }),
      },
    ],
  ),
)

type AuthRequest = {
  path: string
  email: unknown
  headers: Headers | undefined
}

/**
 * Throws once the address or the client's IP address has used up its attempts
 * on the path, and then counts nothing, so a refused request costs no limit an
 * attempt. A path without limits passes
 */
export const limitAuthRequest = async (request: AuthRequest): Promise<void> => {
  const refusal = await consumeAll(readCounted(request))
  if (refusal) {
    const { message, headers } = toRefusal(
      refusal,
      wait => `Too many attempts. ${wait}`,
    )
    throw refuse(`TOO_MANY_REQUESTS`, message, headers)
  }
}

/**
 * Gives back the attempts a successful request spent, on the paths whose
 * limits refund success
 */
export const refundAuthRequest = async (
  request: AuthRequest,
): Promise<void> => {
  if (LIMITERS.get(request.path)?.refundsSuccess) {
    await Promise.all(readCounted(request).map(refund))
  }
}

const readCounted = ({ path, email, headers }: AuthRequest): Counted[] => {
  const limiters = LIMITERS.get(path)
  if (!limiters) {
    return []
  }
  const ip = readClientIp(headers)
  const byIp = { limiter: limiters.ip, key: ip }
  return typeof email === `string`
    ? [
        { limiter: limiters.emailAndIp, key: `${normalizeEmail(email)} ${ip}` },
        byIp,
      ]
    : [byIp]
}
