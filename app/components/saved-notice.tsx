import type { ReactNode } from 'react'
import type { useFetcher } from 'react-router'
import { Notice } from './notice.tsx'
import { useIsLatestAction } from './use-is-latest-action.ts'
import type { SavedResult } from '~/form-replies.server.ts'

type SavedFetcher = ReturnType<typeof useFetcher<SavedResult>>

export const isSaved = (fetcher: SavedFetcher): boolean =>
  fetcher.state === `idle` && fetcher.data?.saved === true

/** Whether the form saved, until another fetcher submits */
export const useIsJustSaved = (fetcher: SavedFetcher): boolean => {
  const isLatest = useIsLatestAction(fetcher)
  return isSaved(fetcher) && isLatest
}

/**
 * Below the button, so the fields above stay put when it appears. Hidden once a
 * later submission fails validation, or once another action submits
 */
export const SavedNotice = ({
  fetcher,
  isFormValid,
  children,
}: {
  fetcher: SavedFetcher
  isFormValid: boolean
  children: ReactNode
}) => {
  const isJustSaved = useIsJustSaved(fetcher)
  return isJustSaved && isFormValid ? (
    <Notice kind='status'>{children}</Notice>
  ) : null
}
