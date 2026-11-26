import type { href } from 'react-router'

/**
 * The pages sign-in may return to. Leave out action-only routes, which answer a
 * visit with a redirect, and every page whose address holds a secret, since the
 * path is written into the sign-in page's address
 */
const RETURN_PAGES = [
  `/settings`,
  `/contests/past`,
  `/contests/years/:year`,
  `/contests/years/:year/leaderboards/:kind`,
  `/contests/years/:year/leaderboards/:kind/:playerId`,
  `/contests/reports`,
  `/contests/trash`,
  `/contests/:contestId`,
  `/contests/:contestId/trash`,
  `/contests/:contestId/leaderboard`,
  `/contests/:contestId/leaderboard/:playerId`,
  `/admin`,
  `/admin/reports`,
  `/admin/educators`,
  `/admin/contests`,
  `/admin/contests/:contestId`,
  `/admin/organizations`,
  `/admin/bracket`,
  `/admin/results`,
  `/admin/setup`,
  `/admin/setup/authenticator-app`,
  `/admin/verify`,
] as const satisfies Parameters<typeof href>[0][]

/** The pages whose address may also hold a leaderboard's page number */
const NUMBERED_PAGES: readonly string[] = [
  `/contests/years/:year/leaderboards/:kind`,
  `/contests/:contestId/leaderboard`,
] satisfies (typeof RETURN_PAGES)[number][]

const PAGE_QUERY = String.raw`(?:\?page=[1-9]\d{0,5})?`

const ID = String.raw`[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}`

const PARAM_PATTERNS: Record<string, string> = {
  year: String.raw`\d{4}`,
  kind: `[a-z]+`,
  contestId: ID,
  playerId: ID,
}

/** A parameter without a pattern matches nothing */
const toPattern = (page: string): RegExp =>
  new RegExp(
    `^${page.replaceAll(/:\w+/gu, param => PARAM_PATTERNS[param.slice(1)] ?? `(?!)`)}${NUMBERED_PAGES.includes(page) ? PAGE_QUERY : ``}$`,
    `u`,
  )

const RETURN_PATTERNS = RETURN_PAGES.map(toPattern)

const RETURN_PARAM = `to`

/**
 * The path, if sign-in may return to it. A whole path must match a page, so
 * none leads to another site
 */
export const toReturnPath = (path: string): string | null =>
  RETURN_PATTERNS.some(pattern => pattern.test(path)) ? path : null

/** The path that returns to the visited page, with only its page number */
export const readVisitedPath = ({
  pathname,
  searchParams,
}: URL): string | null =>
  toReturnPath(`${pathname}?page=${searchParams.get(`page`)}`) ??
  toReturnPath(pathname)

/** Where the request's address says to go after signing in */
export const readReturnPath = ({ url }: { url: string }): string | null =>
  toReturnPath(new URL(url).searchParams.get(RETURN_PARAM) ?? ``)

/** Adds the path to the address of a sign-in page */
export const withReturnPath = (
  signInUrl: string,
  returnPath: string | null,
): string =>
  returnPath === null
    ? signInUrl
    : `${signInUrl}${signInUrl.includes(`?`) ? `&` : `?`}${RETURN_PARAM}=${encodeURIComponent(returnPath)}`
