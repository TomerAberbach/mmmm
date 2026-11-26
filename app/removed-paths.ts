import { href } from 'react-router'

/** What changes the copy of a page about something deleted */
type RemovedContext = {
  /** Whether the contest has no educator */
  isOrphaned: boolean
  /** Whether a newer year is current */
  isPast: boolean
}

export const toDeletedBracketPath = ({
  isOrphaned,
  isPast,
}: RemovedContext): string =>
  withFlags(href(`/bracket-deleted`), {
    [ORPHANED]: isOrphaned,
    [PAST]: isPast,
  })

export const toRemovedContestPath = (isOrphaned: boolean): string =>
  withFlags(href(`/contest-removed`), { [ORPHANED]: isOrphaned })

export const readRemovedContext = (request: Request): RemovedContext => {
  const { searchParams } = new URL(request.url)
  return {
    isOrphaned: searchParams.has(ORPHANED),
    isPast: searchParams.has(PAST),
  }
}

const ORPHANED = `orphaned`
const PAST = `past`

const withFlags = (path: string, flags: Record<string, boolean>): string => {
  const params = new URLSearchParams()
  for (const [flag, isSet] of Object.entries(flags)) {
    if (isSet) {
      params.set(flag, ``)
    }
  }
  return params.size === 0 ? path : `${path}?${params.toString()}`
}
