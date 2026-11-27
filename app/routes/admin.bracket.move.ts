import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.bracket.move.ts'
import { refuseStale } from '~/form-replies.server.ts'
import type { ConfirmReply } from '~/form-replies.server.ts'
import { moveRequestSchema } from '~/move-request.ts'
import { moveCombatants, readMoveImpact } from '~/moves.server.ts'
import type { MoveImpact } from '~/moves.server.ts'

export const loader = (): Response => redirect(href(`/admin/results`))

/** Answers what a move would clear, or makes it once the admin confirms */
export const action = async ({
  request,
}: Route.ActionArgs): Promise<ConfirmReply | { impact: MoveImpact }> => {
  const parsed = moveRequestSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return refuseStale(STALE_MESSAGE)
  }
  if (parsed.data.intent === `preview`) {
    const impact = await readMoveImpact(parsed.data)
    return `refusal` in impact ? refuseStale(STALE_MESSAGE) : { impact }
  }
  return `moved` in (await moveCombatants(parsed.data))
    ? { ok: true }
    : refuseStale(STALE_MESSAGE)
}

const STALE_MESSAGE = `This bracket changed since the page loaded. Reload the page`
