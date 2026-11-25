import type { ConfirmResult } from './components/confirm-dialog.tsx'
import { idsSchema } from './id-list.ts'

/**
 * Runs `change` on the IDs the form lists, and reports an error when it changed
 * nothing. `done` names the change, such as "deleted"
 */
export const changeListed = async (
  request: Request,
  change: (ids: string[]) => Promise<number>,
  done: string,
): Promise<ConfirmResult> => {
  const parsed = idsSchema.safeParse(
    Object.fromEntries(await request.formData()),
  )
  const count = parsed.success ? await change(parsed.data.ids) : 0
  return count > 0
    ? { ok: true }
    : { error: `Nothing was ${done}. Reload the page and try again` }
}
