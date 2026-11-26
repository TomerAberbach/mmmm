import { expect, test } from 'vitest'
import { answerAuthRequest } from './auth-endpoints.server.ts'
import { CLIENT_IP_HEADER } from './client-ip.ts'

const answer = async (method: string, path: string): Promise<number> => {
  const response = await answerAuthRequest(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method,
      headers: {
        'content-type': `application/json`,
        origin: `http://localhost:3000`,
        [CLIENT_IP_HEADER]: `203.0.113.70`,
      },
      ...(method === `POST` && { body: `{}` }),
    }),
  )
  return response.status
}

test.each([
  [`POST`, `/sign-up/email`],
  [`POST`, `/sign-in/email`],
  [`POST`, `/update-user`],
  [`POST`, `/change-password`],
  [`POST`, `/two-factor/disable`],
  [`POST`, `/passkey/delete-passkey`],
  [`GET`, `/get-session`],
  [`POST`, `/reset-password`],
  [`POST`, `/passkey/generate-authenticate-options`],
  [`GET`, `/verify-email/`],
  [`GET`, `//get-session`],
])(`%s %s is not found`, async (method, path) => {
  await expect(answer(method, path)).resolves.toBe(404)
})

test.each([
  [`GET`, `/passkey/generate-register-options`],
  [`POST`, `/passkey/verify-registration`],
  [`GET`, `/passkey/generate-authenticate-options`],
  [`POST`, `/passkey/verify-authentication`],
  [`GET`, `/verify-email?token=altered`],
  [`GET`, `/reset-password/token?callbackURL=%2Freset-password`],
])(`%s %s is answered`, async (method, path) => {
  await expect(answer(method, path)).resolves.not.toBe(404)
})
