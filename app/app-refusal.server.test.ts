import { APIError } from 'better-auth/api'
import { expect, test } from 'vitest'
import { refuse } from './app-refusal.server.ts'
import { readRefusalMessage } from './app-refusal.ts'

test(`a refusal the app wrote shows its message`, () => {
  const error = refuse(`BAD_REQUEST`, `Use a passkey that checks your face`)

  expect(readRefusalMessage(error.body)).toBe(
    `Use a passkey that checks your face`,
  )
})

test(`an error Better Auth wrote shows no message`, () => {
  const error = new APIError(`BAD_REQUEST`, {
    code: `CHALLENGE_NOT_FOUND`,
    message: `Challenge not found`,
  })

  expect(readRefusalMessage(error.body)).toBeUndefined()
})
