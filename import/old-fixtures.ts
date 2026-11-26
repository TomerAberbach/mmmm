import type { OldWinners } from './old-winners.ts'

const SEED_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15]

const DIVISIONS = [`TL`, `BL`, `TR`, `BR`]

/** The bottom left division's 16 seed is the wild card */
const WILD_CARD_INDEX = 16 + 1

/**
 * A heap in mmmm-old's shape, with combatants such as "TL 1 (1)". With
 * `decided`, every battle's first side won
 */
export const createOldWinners = ({
  decided,
}: {
  decided: boolean
}): OldWinners => {
  const winners: OldWinners = Array.from({ length: 127 }, () => null)
  for (let index = 0; index < 64; index++) {
    const seed = SEED_ORDER[index % 16]!
    const name = `${DIVISIONS[Math.trunc(index / 16)]!} ${seed} (${seed})`
    winners[63 + index] =
      index === WILD_CARD_INDEX
        ? [decided ? `Left (W/16)` : null, `Left (W/16)`, `Right (W/16)`]
        : name
  }
  if (decided) {
    for (let node = 62; node >= 0; node--) {
      const side = winners[2 * node + 1]!
      winners[node] = Array.isArray(side) ? side[0]! : side
    }
  }
  return winners
}
