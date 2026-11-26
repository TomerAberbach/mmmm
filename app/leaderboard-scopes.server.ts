import { data, redirect } from 'react-router'
import type { RouterContextProvider } from 'react-router'
import { readCurrentYear } from './brackets.server.ts'
import type { LeaderboardPage, PlayerRank } from './leaderboard-row.ts'
import {
  readLeaderboard,
  readLeaderboardSubmission,
  readPlayerRank,
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

/** Null before any bracket is published */
export const readGlobalScope = async (): Promise<NamedScope | null> => {
  const current = await readCurrentYear()
  return current && toGlobalScope(current.year)
}

export const toGlobalScope = (year: number): NamedScope => ({
  scope: { kind: `global`, year },
  name: `Everyone`,
})

/** A player's rank in one scope. Null where its leaderboard leaves them out */
export type ScopeRank = {
  kind: LeaderboardScope[`kind`]
  name: string
  rank: PlayerRank | null
}

/** The player's contest, then their organization if any, then everyone */
export const readPlayerRanks = async (
  contest: { id: string; name: string; year: number },
  playerId: string,
): Promise<ScopeRank[]> => {
  const scopes = [
    toContestScope(contest),
    await readContestOrganizationScope(contest),
    toGlobalScope(contest.year),
  ]
  const ranks: ScopeRank[] = []
  // One at a time, so a burst of players can't use up the pool
  for (const named of scopes) {
    if (named) {
      const { scope, name } = named
      ranks.push({
        kind: scope.kind,
        name,
        rank: await readPlayerRank(scope, playerId),
      })
    }
  }
  return ranks
}

/** Null without an organization, or before any bracket is published */
export const readEducatorOrganizationScope = async (
  educatorId: string,
): Promise<NamedScope | null> => {
  const [organization, current] = await Promise.all([
    readOrganization(educatorId),
    readCurrentYear(),
  ])
  return organization && current
    ? toOrganizationScope(organization, current.year)
    : null
}

/** Null when the contest counts toward no organization */
export const readContestOrganizationScope = async (contest: {
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
): Promise<{ name: string; leaderboard: LeaderboardPage }> => {
  const leaderboard =
    named &&
    (await readLeaderboard(named.scope, viewer, readPageNumber(request)))
  if (!leaderboard) {
    // React Router follows a thrown redirect
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect(fallback)
  }
  return { name: named.name, leaderboard }
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
