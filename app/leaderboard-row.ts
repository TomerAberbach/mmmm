import type { PageNumber } from './page-number.ts'

/** Stands in for a display name that's hidden or removed */
export const UNNAMED_PLAYER = `Player`

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
  /** Null for a leaderboard without pages */
  page: PageNumber | null
}

/** Where a player ranks among a leaderboard's players */
export type PlayerRank = { rank: number; total: number }

/** Such as "Top 8%". Null in the bottom half, where it says little */
export const formatPercentile = ({
  rank,
  total,
}: PlayerRank): string | null => {
  const percent = Math.ceil((100 * rank) / total)
  return percent <= 50 ? `Top ${percent}%` : null
}

const ORDINAL = new Intl.PluralRules(`en-US`, { type: `ordinal` })

const ORDINAL_SUFFIXES: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: `st`,
  two: `nd`,
  few: `rd`,
}

/** Such as "1st" or "12th" */
export const formatRank = (rank: number): string =>
  `${rank.toLocaleString(`en-US`)}${ORDINAL_SUFFIXES[ORDINAL.select(rank)] ?? `th`}`
