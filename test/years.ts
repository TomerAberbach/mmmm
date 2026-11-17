import type { BracketInput } from '../app/bracket-input.ts'
import {
  saveUnpublishedBracket,
  setBracketPublished,
} from '../app/brackets.server.ts'
import { prisma } from '../app/db.server.ts'
import { BRACKET_2026 } from '../prisma/brackets.ts'

// `claimYear` returns years below this one, so a bracket published from here
// up is newer than any bracket in a claimed year
const FIRST_YEAR = 9000

const LOCK_KEY = 9000

// Creates the sequence `claimYear` reads, once per test database. Its last
// value is below `FIRST_YEAR`, and it fails instead of wrapping around
export const CREATE_YEAR_SEQUENCE_SQL = `CREATE SEQUENCE test_year START 2100 MAXVALUE ${FIRST_YEAR - 1}`

// Returns a year that no other test in this run stores a bracket under
export const claimYear = async (): Promise<number> => {
  const [row] = await prisma.$queryRaw<{ year: number }[]>`
    SELECT nextval('test_year')::int AS year
  `
  return row!.year
}

type BracketOptions = { published: boolean; input?: BracketInput }

// Stores 2026's bracket, or `input`, under the year
const storeBracket = async (
  year: number,
  { published, input = BRACKET_2026 }: BracketOptions,
): Promise<void> => {
  await saveUnpublishedBracket(year, input)
  await setBracketPublished(year, published)
}

// Stores 2026's bracket, or `input`, in a new year, and returns the year
export type AddYear = (options: BracketOptions) => Promise<number>

// Adds years from `claimYear`, older than any year `withCurrentYear` adds
export const addClaimedYear: AddYear = async options => {
  const year = await claimYear()
  await storeBracket(year, options)
  return year
}

// Stores `input` unpublished in a year from `claimYear`, and returns the
// bracket's ID
export const createClaimedBracket = async (
  input: BracketInput,
): Promise<string> => {
  const year = await addClaimedYear({ published: false, input })
  const { id } = await prisma.bracket.findUniqueOrThrow({
    where: { yearId: year },
    select: { id: true },
  })
  return id
}

// Runs `run` while no other test adds a year from `FIRST_YEAR` up, so the
// newest year `run` publishes stays the current year until `run` ends
export const withCurrentYear = <Result>(
  run: (addYear: AddYear) => Promise<Result>,
): Promise<Result> =>
  prisma.$transaction(
    async tx => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${LOCK_KEY})`
      // Each year is newer than any year stored so far
      const addYear: AddYear = async options => {
        const { _max } = await prisma.year.aggregate({ _max: { id: true } })
        const year = Math.max(FIRST_YEAR, (_max.id ?? 0) + 1)
        await storeBracket(year, options)
        return year
      }
      return run(addYear)
    },
    // The lock waits for other tests to finish
    { timeout: 60_000 },
  )
