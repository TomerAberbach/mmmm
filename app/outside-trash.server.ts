import type { Prisma } from './generated/prisma/client.ts'

/** Matches contests outside the trash */
export const CONTEST_OUTSIDE_TRASH = { deletedAt: null } as const

/** Matches players outside the trash. A deleted contest takes its players along */
export const PLAYER_OUTSIDE_TRASH = {
  deletedAt: null,
  contest: CONTEST_OUTSIDE_TRASH,
} as const

/** Matches players outside the trash, only in a contest the educator runs */
export const educatorPlayers = (
  educatorId: string,
  contestId: string,
): Prisma.PlayerWhereInput => ({
  contestId,
  deletedAt: null,
  contest: { educatorId, ...CONTEST_OUTSIDE_TRASH },
})
