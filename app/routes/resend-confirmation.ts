import type { Route } from './+types/resend-confirmation.ts'
import { emailSchema } from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import type { ResendResult } from '~/components/check-email.tsx'

// Answers the same whether or not the address has an unconfirmed educator
export const action = async ({
  request,
}: Route.ActionArgs): Promise<ResendResult> => {
  const email = emailSchema.safeParse((await request.formData()).get(`email`))
  if (email.success) {
    await auth.api.sendVerificationEmail({ body: { email: email.data } })
  }
  return { sentAt: new Date() }
}
