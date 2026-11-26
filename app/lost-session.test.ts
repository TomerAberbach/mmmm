import { redirect } from 'react-router'
import { expect, test } from 'vitest'
import { readLostSessionMessage } from './lost-session.ts'

test.each([
  [`/admin/verify`, `second factor`],
  [`/admin/setup`, `second factor`],
  [`/sign-in`, `signed out`],
])(`a redirect to %s mentions %s`, (location, reason) => {
  expect(readLostSessionMessage(redirect(location))).toContain(reason)
})

test(`a redirect after saving isn't a lost session`, () => {
  expect(readLostSessionMessage(redirect(`/admin`))).toBeUndefined()
})
