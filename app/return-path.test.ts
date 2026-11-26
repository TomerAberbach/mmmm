import { expect, test } from 'vitest'
import {
  readReturnPath,
  readVisitedPath,
  toReturnPath,
  withReturnPath,
} from './return-path.ts'

const ID = `0b6f2c4e-1a2b-4c3d-8e4f-5a6b7c8d9e0f`

test.each([
  `/settings`,
  `/contests/past`,
  `/contests/years/2026/leaderboards/global`,
  `/contests/${ID}`,
  `/contests/${ID}/leaderboard/${ID}`,
  `/admin`,
  `/admin/bracket`,
  `/admin/setup`,
  `/admin/setup/authenticator-app`,
  `/admin/verify`,
  `/contests/years/2026/leaderboards/global?page=2`,
  `/contests/${ID}/leaderboard?page=12`,
])(`%s is returned to`, path => {
  expect(toReturnPath(path)).toBe(path)
})

const FORBIDDEN_PATHS = [
  ``,
  `/`,
  `settings`,
  `//evil.example`,
  `///evil.example`,
  String.raw`/\evil.example`,
  String.raw`\\evil.example`,
  String.raw`/settings\..\evil`,
  `https://evil.example`,
  `https://evil.example/settings`,
  `http:/settings`,
  `javascript:alert(1)`,
  `/%2Fevil.example`,
  `/%2f%2fevil.example`,
  `%2F%2Fevil.example`,
  `/%5Cevil.example`,
  `/%73ettings`,
  `//evil.example/settings`,
  `/settings//evil.example`,
  `/settings/../api/auth/get-session`,
  `/settings@evil.example`,
  `/settings\n`,
  `/settings\r\nLocation: https://evil.example`,
  `/\t/evil.example`,
  `\t//evil.example`,
  ` /settings`,
  `/settings\0`,
  `/settings${String.fromCodePoint(0x20_28)}`,
  `/ſettings`,
  `/settings?next=//evil.example`,
  `/settings?page=2`,
  `/contests/${ID}/leaderboard?page=0`,
  `/contests/${ID}/leaderboard?page=-1`,
  `/contests/${ID}/leaderboard?page=1e9`,
  `/contests/${ID}/leaderboard?page=2&next=//evil.example`,
  `/contests/${ID}/leaderboard?page=//evil.example`,
  `/contests/${ID}/leaderboard?next=2`,
  `/settings#//evil.example`,
  `/settings/`,
  `/SETTINGS`,
  `/api/auth/get-session`,
  `/api/auth/reset-password/token`,
  `/sign-out`,
  `/sign-in`,
  `/sign-in/code`,
  `/reset-password`,
  `/reset-password?token=secret`,
  `/admin/setup?token=secret`,
  `/my-bracket/secret`,
  `/play/secret`,
  `/confirm-address/secret`,
  `/settings/delete-account`,
  `/settings/name`,
  `/contests/new`,
  `/contests/organization`,
  `/contests/${ID}/delete`,
  `/contests/${ID}/link`,
  `/admin/bracket/delete`,
  `/admin/results/save`,
  `/admin/educators/${ID}/delete`,
]

test.each([
  { visited: `?page=2`, query: `?page=2` },
  { visited: `?q=a&page=2`, query: `?page=2` },
  { visited: `?page=//evil.example`, query: `` },
  { visited: ``, query: `` },
])(
  `a visit to a leaderboard's "$visited" returns to "$query"`,
  ({ visited, query }) => {
    const leaderboard = `/contests/${ID}/leaderboard`
    const url = new URL(`${leaderboard}${visited}`, `http://localhost`)

    expect(readVisitedPath(url)).toBe(`${leaderboard}${query}`)
  },
)

test.each(FORBIDDEN_PATHS)(`%j is never returned to`, path => {
  expect(toReturnPath(path)).toBeNull()
})

test.each(FORBIDDEN_PATHS)(
  `a sign-in address that asks for %j is ignored`,
  path => {
    const url = withReturnPath(`http://localhost/sign-in`, path)

    expect(readReturnPath({ url })).toBeNull()
  },
)

test(`an encoded slash decodes once and still has to match`, () => {
  const url = `http://localhost/sign-in?to=%252Fsettings`

  expect(readReturnPath({ url })).toBeNull()
})

test.each([`/sign-in`, `/sign-in?challenge-expired`])(
  `%s keeps the path`,
  signInUrl => {
    const url = `http://localhost${withReturnPath(signInUrl, `/settings`)}`

    expect(readReturnPath({ url })).toBe(`/settings`)
  },
)
