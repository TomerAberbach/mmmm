import { data, isRouteErrorResponse } from 'react-router'

const BROKEN_LINK = `BROKEN_LINK`

/** Throw it to answer with the broken link page */
export const brokenLink = (): ReturnType<typeof data<string>> =>
  data(BROKEN_LINK, { status: 404 })

export const isBrokenLink = (error: unknown): boolean =>
  isRouteErrorResponse(error) && error.data === BROKEN_LINK
