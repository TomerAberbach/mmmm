import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.results.save.ts'
import { resultRequestSchema } from '~/result-request.ts'
import { saveResult } from '~/results.server.ts'

export const loader = (): Response => redirect(href(`/admin/results`))

export const action = async ({
  request,
}: Route.ActionArgs): Promise<Response> => {
  const parsed = resultRequestSchema.safeParse(
    await request.json().catch(() => null),
  )
  return parsed.success && `saved` in (await saveResult(parsed.data))
    ? new Response(null)
    : new Response(null, { status: 409 })
}
