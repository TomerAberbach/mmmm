import type { Prisma } from './generated/prisma/client.ts'
import { CONTEST_OUTSIDE_TRASH } from './outside-trash.server.ts'
import { withCurrentYear } from './years.server.ts'

declare const EDITABLE: unique symbol

/**
 * Matches the contests the educator runs in the current year. Only
 * `changeContests` makes one, so a change to an educator's contests can't reach
 * a past year's
 */
export type EditableContests = {
  educatorId: string
  year: { in: number[] }
  [EDITABLE]: true
}

/**
 * Runs `change` on the educator's contests in the current year, which stays
 * current until `change` ends. They match nothing before any bracket is
 * published
 */
export const changeContests = <Result>(
  educatorId: string,
  change: (
    tx: Prisma.TransactionClient,
    contests: EditableContests,
  ) => Promise<Result>,
): Promise<Result> =>
  withCurrentYear((tx, current) =>
    change(tx, {
      educatorId,
      year: { in: current ? [current.year] : [] },
    } as EditableContests),
  )

/** Matches players outside the trash in one of the contests */
export const editablePlayers = (
  contests: EditableContests,
  contestId: string,
): Prisma.PlayerWhereInput => ({
  contestId,
  deletedAt: null,
  contest: { ...contests, ...CONTEST_OUTSIDE_TRASH },
})
