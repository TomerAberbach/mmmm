import { useState } from 'react'
import { useFetchers, useMatches } from 'react-router'
import type { FetcherWithComponents } from 'react-router'

/**
 * Whether no other fetcher has submitted since the fetcher's result, so a notice
 * of the result isn't left beside a later one
 */
export const useIsLatestAction = ({
  state,
  data,
}: Pick<FetcherWithComponents<unknown>, `state` | `data`>): boolean => {
  const isAnySubmitting = useFetchers().some(
    ({ formMethod }) => formMethod !== undefined,
  )
  // A fast action can start and finish between two renders, but its success
  // still replaces the loader data
  const loaderData = useMatches().map(match => match.loaderData)
  const [result, setResult] = useState<{
    data: unknown
    loaderData: unknown[]
    isLatest: boolean
  }>()
  const isFinished = state === `idle` && data !== undefined
  if (isFinished && data !== result?.data) {
    setResult({ data, loaderData, isLatest: !isAnySubmitting })
  } else if (
    isFinished &&
    result?.isLatest &&
    (isAnySubmitting || !isSame(loaderData, result.loaderData))
  ) {
    setResult({ ...result, isLatest: false })
  }
  // Until the page has the result's data, nothing can have come later
  return !result || result.data !== data || result.isLatest
}

const isSame = (
  first: readonly unknown[],
  second: readonly unknown[],
): boolean =>
  first.length === second.length &&
  first.every((value, index) => value === second[index])
