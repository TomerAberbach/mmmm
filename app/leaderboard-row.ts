/** A leaderboard's row as one viewer sees it */
export type LeaderboardRow = {
  playerId: string
  /** The player's name, or what stands in for one hidden from the viewer */
  label: string
  score: number
  rank: number
  /** Whether it's the viewer's own */
  isOwn: boolean
}

export type LeaderboardPage = {
  rows: LeaderboardRow[]
  /** Counts from 1. Null for a leaderboard without pages */
  page: { number: number; count: number } | null
}

/** The page in the address, or the first for anything else */
export const readPageNumber = (request: Request): number => {
  const page = Number(new URL(request.url).searchParams.get(`page`))
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

const ORDINAL = new Intl.PluralRules(`en-US`, { type: `ordinal` })

const ORDINAL_SUFFIXES: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: `st`,
  two: `nd`,
  few: `rd`,
}

/** Such as "1st" or "12th" */
export const formatRank = (rank: number): string =>
  `${rank}${ORDINAL_SUFFIXES[ORDINAL.select(rank)] ?? `th`}`
