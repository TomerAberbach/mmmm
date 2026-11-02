import type { ReactNode } from 'react'
import type { useFetcher } from 'react-router'
import { Notice } from './notice.tsx'
import type { SavedResult } from '~/form-replies.server.ts'

type SavedFetcher = ReturnType<typeof useFetcher<SavedResult>>

export const isSaved = (fetcher: SavedFetcher): boolean =>
  fetcher.state === `idle` && fetcher.data?.saved === true

// Below the button, so the fields above stay put when it appears. Hidden once a
// later submission fails validation
export const SavedNotice = ({
  fetcher,
  isFormValid,
  children,
}: {
  fetcher: SavedFetcher
  isFormValid: boolean
  children: ReactNode
}) =>
  isSaved(fetcher) && isFormValid ? (
    <Notice kind='status'>{children}</Notice>
  ) : null
