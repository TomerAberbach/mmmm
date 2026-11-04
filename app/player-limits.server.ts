import { RateLimiterMemory } from 'rate-limiter-flexible'
import { consumeAll, readClientIp, toRefusal } from './limits.server.ts'
import type { LimitRefusal } from './limits.server.ts'

const HOUR = 60 * 60

// A contest can hold a whole school's players, and a whole school can share
// one IP address, so both limits are generous. Counts stay in memory only, so
// no IP address is ever stored
const PER_CONTEST = new RateLimiterMemory({
  keyPrefix: `new-player:contest`,
  points: 300,
  duration: HOUR,
})
const PER_IP = new RateLimiterMemory({
  keyPrefix: `new-player:ip`,
  points: 1000,
  duration: HOUR,
})

// Counts a new bracket in the contest, and resolves to a refusal once the
// contest or the client's IP address has used up its attempts. A refused
// request costs neither limit an attempt
export const limitNewPlayer = async (
  request: Request,
  contestId: string,
): Promise<LimitRefusal | undefined> => {
  const refusal = await consumeAll([
    { limiter: PER_CONTEST, key: contestId },
    { limiter: PER_IP, key: readClientIp(request.headers) },
  ])
  return (
    refusal &&
    toRefusal(refusal, wait => `Too many new brackets right now. ${wait}`)
  )
}
