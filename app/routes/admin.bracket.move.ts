import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.bracket.move.ts'
import { moveRequestSchema } from '~/move-request.ts'
import { moveCombatants, readMoveImpact } from '~/moves.server.ts'
import type { MoveReply } from '~/moves.server.ts'

export const loader = (): Response => redirect(href(`/admin/results`))

/** Answers what a move would clear, or makes it once the admin confirms */
export const action = async ({
  request,
}: Route.ActionArgs): Promise<MoveReply> => {
  const parsed = moveRequestSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return STALE
  }
  if (parsed.data.intent === `preview`) {
    const impact = await readMoveImpact(parsed.data)
    return `refusal` in impact ? STALE : { impact }
  }
  return `moved` in (await moveCombatants(parsed.data)) ? { ok: true } : STALE
}

const STALE = {
  error: `This bracket changed since the page loaded. Reload the page`,
}
