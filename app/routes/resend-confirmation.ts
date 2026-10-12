import type { Route } from './+types/resend-confirmation.ts'
import { emailSchema } from '~/auth-forms.ts'
import { isTooManyAttempts } from '~/auth-limits.server.ts'
import { auth } from '~/auth.server.ts'
import type { ResendResult } from '~/components/check-email.tsx'

// Answers the same whether or not the address has an unconfirmed educator.
// Better Auth checks a signed-in educator's own address instead, and refuses
// any other, so the request goes without its cookies
export const action = async ({
  request,
}: Route.ActionArgs): Promise<ResendResult> => {
  const email = emailSchema.safeParse((await request.formData()).get(`email`))
  try {
    if (email.success) {
      await auth.api.sendVerificationEmail({
        body: { email: email.data },
        headers: withoutCookies(request.headers),
      })
    }
  } catch (error) {
    if (isTooManyAttempts(error)) {
      return { error: error.body.message }
    }
    throw error
  }
  return { sentAt: new Date() }
}

const withoutCookies = (headers: Headers): Headers => {
  const copy = new Headers(headers)
  copy.delete(`cookie`)
  return copy
}
