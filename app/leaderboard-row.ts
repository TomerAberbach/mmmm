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

const ORDINAL = new Intl.PluralRules(`en-US`, { type: `ordinal` })

const ORDINAL_SUFFIXES: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: `st`,
  two: `nd`,
  few: `rd`,
}

/** Such as "1st" or "12th" */
export const formatRank = (rank: number): string =>
  `${rank}${ORDINAL_SUFFIXES[ORDINAL.select(rank)] ?? `th`}`
