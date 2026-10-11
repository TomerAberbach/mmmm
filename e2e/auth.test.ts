import { expect, test } from '@playwright/test'

test(`an educator who signed up can sign in through the auth route`, async ({
  baseURL,
  playwright,
  request,
}) => {
  const credentials = {
    email: `educator-${crypto.randomUUID()}@example.com`,
    password: `correct horse battery`,
  }
  const signUp = await request.post(`/api/auth/sign-up/email`, {
    data: { name: `Ms. Frizzle`, ...credentials },
  })
  expect(signUp.ok()).toBe(true)

  // Sign-up sets a session cookie, so sign in without it
  const signedOut = await playwright.request.newContext({ baseURL })
  const signIn = await signedOut.post(`/api/auth/sign-in/email`, {
    data: credentials,
  })
  const session = await signedOut.get(`/api/auth/get-session`)

  expect(signIn.ok()).toBe(true)
  expect(await session.json()).toMatchObject({
    user: { email: credentials.email },
  })
  await signedOut.dispose()
})
