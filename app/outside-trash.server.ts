/** Matches contests outside the trash */
export const CONTEST_OUTSIDE_TRASH = { deletedAt: null } as const

/** Matches players outside the trash. A deleted contest takes its players along */
export const PLAYER_OUTSIDE_TRASH = {
  deletedAt: null,
  contest: CONTEST_OUTSIDE_TRASH,
} as const
