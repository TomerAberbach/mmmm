import { toBattleKey } from './bracket.ts'
import {
  readBracketRows,
  readResultRows,
  replacePlaces,
} from './brackets.server.ts'
import type { ConfirmResult } from './form-replies.server.ts'
import type { Prisma } from './generated/prisma/client.ts'
import type { MoveRequest } from './move-request.ts'
import {
  listDisturbedBattles,
  readArrangement,
  swapCombatants,
} from './moves.ts'
import { CONTEST_OUTSIDE_TRASH } from './outside-trash.server.ts'
import { clearPicks } from './player-picks.server.ts'
import { clearResults, hasSameKeys } from './results.server.ts'
import { toSeededBracket } from './seeded-bracket.ts'
import type { StoredBracket } from './seeded-bracket.ts'
import { withCurrentYear, withCurrentYearAlone } from './years.server.ts'
import type { CurrentYear } from './years.server.ts'

/** What a move clears, with counts that leave out the trash */
export type MoveImpact = {
  battles: number
  submissions: number
  /** Drafts of players who haven't submitted */
  drafts: number
  /** The keys of the battles whose results it clears */
  results: string[]
}

/** What the route answers a preview or a move */
export type MoveReply = ConfirmResult | { impact: MoveImpact }

export type MoveRefusal = { refusal: `STALE` }

/** Refuses when the bracket, the year, or the lock isn't as the admin saw */
export const readMoveImpact = (
  request: MoveRequest,
): Promise<MoveImpact | MoveRefusal> =>
  withMove(
    request,
    withCurrentYear,
    async (tx, { year, disturbedKeys, disturbedIds }) => {
      const results = await listClearedResults(tx, year, disturbedKeys)
      const player = (stage: `DRAFT` | `SUBMISSION`) =>
        ({
          deletedAt: null,
          contest: { year, ...CONTEST_OUTSIDE_TRASH },
          picks: { some: { stage, battleId: { in: disturbedIds } } },
        }) satisfies Prisma.PlayerWhereInput
      return {
        battles: disturbedIds.length,
        submissions: await tx.submission.count({
          where: { player: player(`SUBMISSION`) },
        }),
        drafts: await tx.player.count({
          where: { ...player(`DRAFT`), submission: null },
        }),
        results,
      }
    },
  )

/**
 * Moves the combatants, and clears the picks and results of each battle where
 * different combatants meet now. Before the lock, a submission that loses picks
 * returns to a draft. After it, the cleared picks score nothing
 */
export const moveCombatants = (
  request: MoveRequest,
): Promise<{ moved: true } | MoveRefusal> =>
  withMove(request, withCurrentYearAlone, async (tx, move) => {
    const { year, current, before, after, battleIdByKey, disturbedKeys } = move
    const results = await listClearedResults(tx, year, disturbedKeys)
    if (!hasSameKeys(results, request.results)) {
      return { refusal: `STALE` } as const
    }
    await replacePlaces(tx, year, before, after)
    if (disturbedKeys.size > 0) {
      await clearPicks(tx, year, move.disturbedIds, current.isLocked)
      await clearResults(
        tx,
        year,
        toSeededBracket(after),
        battleIdByKey,
        disturbedKeys,
      )
    }
    return { moved: true } as const
  })

const listClearedResults = async (
  tx: Prisma.TransactionClient,
  year: number,
  disturbedKeys: ReadonlySet<string>,
): Promise<string[]> =>
  Object.keys(await readResultRows(year, tx)).filter(key =>
    disturbedKeys.has(key),
  )

type Move = {
  year: number
  current: CurrentYear
  before: StoredBracket
  after: StoredBracket
  battleIdByKey: ReadonlyMap<string, string>
  disturbedKeys: ReadonlySet<string>
  disturbedIds: string[]
}

const withMove = <Result>(
  { year, arrangement, isLocked, swaps }: MoveRequest,
  withYear: typeof withCurrentYear,
  change: (tx: Prisma.TransactionClient, move: Move) => Promise<Result>,
): Promise<Result | MoveRefusal> =>
  withYear<Result | MoveRefusal>(async (tx, current) => {
    if (current?.year !== year || current.isLocked !== isLocked) {
      return { refusal: `STALE` }
    }
    const { bracket: before, battleIdByKey } = await readBracketRows(year, tx)
    const after = swapCombatants(before, swaps)
    if (!after || readArrangement(before) !== arrangement) {
      return { refusal: `STALE` }
    }
    const keys = listDisturbedBattles(
      toSeededBracket(before),
      toSeededBracket(after),
    ).map(toBattleKey)
    return change(tx, {
      year,
      current,
      before,
      after,
      battleIdByKey,
      disturbedKeys: new Set(keys),
      disturbedIds: keys.map(key => battleIdByKey.get(key)!),
    })
  })
