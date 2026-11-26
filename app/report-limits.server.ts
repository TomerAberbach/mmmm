import { RateLimiterMemory } from 'rate-limiter-flexible'
import { readClientIp, toRefusal, tryConsume } from './limits.server.ts'

/** A whole school can share one IP address */
const PER_IP = new RateLimiterMemory({
  keyPrefix: `report:ip`,
  points: 100,
  duration: 60 * 60,
})

/** Resolves to why the report is refused, if it is */
export const limitReport = async (
  request: Request,
): Promise<string | undefined> => {
  const refusal = await tryConsume(PER_IP, readClientIp(request.headers))
  return (
    refusal &&
    toRefusal(refusal, wait => `Too many reports right now. ${wait}`).message
  )
}
