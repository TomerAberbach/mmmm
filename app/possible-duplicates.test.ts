import { expect, test } from 'vitest'
import type { SubmissionStatus } from './generated/prisma/client.ts'
import { findPossibleDuplicates } from './possible-duplicates.ts'

const player = (
  id: string,
  displayName: string,
  status: SubmissionStatus | null = `PENDING`,
) => ({ id, displayName, status })

const findDuplicateIds = (players: ReturnType<typeof player>[]) =>
  Object.fromEntries(
    [...findPossibleDuplicates(players)].map(([id, others]) => [
      id,
      others.map(other => other.id),
    ]),
  )

test.each([
  [`Maya R.`, `Maya R.`],
  [`Maya R.`, `maya r`],
  [`Maya R.`, `MayaR`],
  [`José L.`, `Jose L`],
  [`Maya ❤️`, `Maya`],
])(`%s and %s might be the same player`, (first, second) => {
  const duplicates = findDuplicateIds([
    player(`first`, first),
    player(`second`, second),
  ])

  expect(duplicates).toStrictEqual({ first: [`second`], second: [`first`] })
})

test.each([
  [`Maya R.`, `Maya`],
  [`Maya R.`, `Mya R.`],
  [`राम`, `रम`],
  [`🐯`, `🦁`],
  [`❤️`, `☀️`],
])(`%s and %s are different players`, (first, second) => {
  const duplicates = findDuplicateIds([
    player(`first`, first),
    player(`second`, second),
  ])

  expect(duplicates).toStrictEqual({})
})

test(`every other player with the name is a possible duplicate`, () => {
  const duplicates = findDuplicateIds([
    player(`first`, `Maya R.`),
    player(`second`, `maya r`),
    player(`third`, `MayaR`),
  ])

  expect(duplicates).toStrictEqual({
    first: [`second`, `third`],
    second: [`first`, `third`],
    third: [`first`, `second`],
  })
})

test.each([
  [`PENDING`, { first: [`second`] }],
  [null, { first: [`second`] }],
  [`APPROVED`, {}],
  [`REJECTED`, {}],
] as const)(
  `beside a rejected player of the same name, a player with status %s has duplicates %o`,
  (status, expected) => {
    const duplicates = findDuplicateIds([
      player(`first`, `Maya R.`, status),
      player(`second`, `maya r`, `REJECTED`),
    ])

    expect(duplicates).toStrictEqual(expected)
  },
)
