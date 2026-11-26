import { data, redirect } from 'react-router'
import type { RouterContextProvider } from 'react-router'
import type { LeaderboardPage, PlayerRank } from './leaderboard-row.ts'
import {
  readLeaderboard,
  readLeaderboardSubmission,
  readPlayerRank,
  readRankedContestId,
} from './leaderboards.server.ts'
import type {
  LeaderboardScope,
  LeaderboardSubmission,
  LeaderboardViewer,
} from './leaderboards.server.ts'
import {
  readContestOrganization,
  readOrganization,
} from './organizations.server.ts'
import { describeOrganization } from './organizations.ts'
import type { Organization } from './organizations.ts'
import { readPageNumber } from './page-number.ts'
import { readRequiredEducator } from './session.server.ts'

/** A leaderboard, and what its ranks are in, such as a contest's name */
export type NamedScope = { scope: LeaderboardScope; name: string }

type LeaderboardKind = LeaderboardScope[`kind`]

export const LEADERBOARD_TITLES: Record<LeaderboardKind, string> = {
  contest: `Leaderboard`,
  organization: `Organization leaderboard`,
  global: `Global leaderboard`,
}

/** The scope whose kind is in the address, or null when the viewer has none */
export const findScope = (
  scopes: NamedScope[],
  kind: string,
): NamedScope | null => scopes.find(({ scope }) => scope.kind === kind) ?? null

export const toContestScope = ({
  id,
  name,
  year,
}: {
  id: string
  name: string
  year: number
}): NamedScope => ({
  scope: { kind: `contest`, contestId: id, year },
  name,
})

const toGlobalScope = (year: number): NamedScope => ({
  scope: { kind: `global`, year },
  name: `Everyone`,
})

/** A player's rank in one scope. Null where its leaderboard leaves them out */
export type ScopeRank = {
  kind: LeaderboardKind
  name: string
  rank: PlayerRank | null
}

/** The player's contest, then their organization if any, then everyone */
export const readPlayerScopes = async (contest: {
  id: string
  name: string
  year: number
}): Promise<NamedScope[]> =>
  [
    toContestScope(contest),
    await readContestOrganizationScope(contest),
    toGlobalScope(contest.year),
  ].filter(named => named !== null)

/** Ranks in the order of `readPlayerScopes` */
export const readPlayerRanks = async (
  contest: { id: string; name: string; year: number },
  playerId: string,
): Promise<ScopeRank[]> => {
  const ranks: ScopeRank[] = []
  // One at a time, so a burst of players can't use up the pool
  for (const { scope, name } of await readPlayerScopes(contest)) {
    ranks.push({
      kind: scope.kind,
      name,
      rank: await readPlayerRank(scope, playerId),
    })
  }
  return ranks
}

/** The educator's organization if any, then everyone */
export const readEducatorScopes = async (
  educatorId: string,
  year: number,
): Promise<NamedScope[]> =>
  [
    await readEducatorOrganizationScope(educatorId, year),
    toGlobalScope(year),
  ].filter(named => named !== null)

/** Null unless the player has a row in one of the scopes */
export const findRankedContestId = async (
  scopes: NamedScope[],
  playerId: string | null,
): Promise<string | null> => {
  if (playerId === null) {
    return null
  }
  for (const { scope } of scopes) {
    const contestId = await readRankedContestId(scope, playerId)
    if (contestId !== null) {
      return contestId
    }
  }
  return null
}

/** Null without an organization */
const readEducatorOrganizationScope = async (
  educatorId: string,
  year: number,
): Promise<NamedScope | null> => {
  const organization = await readOrganization(educatorId)
  return organization && toOrganizationScope(organization, year)
}

/** Null when the contest counts toward no organization */
const readContestOrganizationScope = async (contest: {
  id: string
  year: number
}): Promise<NamedScope | null> => {
  const organization = await readContestOrganization(contest.id)
  return organization && toOrganizationScope(organization, contest.year)
}

const toOrganizationScope = (
  organization: Organization,
  year: number,
): NamedScope => ({
  scope: { kind: `organization`, domain: organization.domain, year },
  name: describeOrganization(organization),
})

/** The signed-in educator, as a leaderboard's viewer */
export const readEducatorViewer = (
  context: Readonly<RouterContextProvider>,
): LeaderboardViewer => ({
  kind: `educator`,
  educatorId: readRequiredEducator(context).id,
})

/** Redirects to `fallback` without a scope, and while its year is open */
export const readRequiredLeaderboard = async (
  request: Request,
  named: NamedScope | null,
  viewer: LeaderboardViewer,
  fallback: string,
): Promise<{
  kind: LeaderboardKind
  name: string
  year: number
  leaderboard: LeaderboardPage
}> => {
  const leaderboard =
    named &&
    (await readLeaderboard(named.scope, viewer, readPageNumber(request)))
  if (!leaderboard) {
    // React Router follows a thrown redirect
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect(fallback)
  }
  const { kind, year } = named.scope
  return { kind, name: named.name, year, leaderboard }
}

/** Throws the not-found page for a player without a row */
export const readRequiredSubmission = async (
  named: NamedScope | null,
  playerId: string,
  viewer: LeaderboardViewer,
): Promise<{
  submission: LeaderboardSubmission
  year: number
  scopeName: string
}> => {
  const submission =
    named && (await readLeaderboardSubmission(named.scope, playerId, viewer))
  if (!submission) {
    // React Router renders a thrown response with the error page
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw data(null, { status: 404 })
  }
  return { submission, year: named.scope.year, scopeName: named.name }
}
