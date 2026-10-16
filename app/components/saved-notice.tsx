import type { SubmissionResult } from '@conform-to/react'
import type { ReactNode } from 'react'
import type { useFetcher } from 'react-router'
import { Notice } from './notice.tsx'

// What an action answers once it saves a form submitted through a fetcher
export type SavedResult = { result: SubmissionResult; saved?: true }

// Below the button, so the fields above stay put when it appears. Hidden once a
// later submission fails validation
export const SavedNotice = ({
  fetcher,
  isFormValid,
  children,
}: {
  fetcher: ReturnType<typeof useFetcher<SavedResult>>
  isFormValid: boolean
  children: ReactNode
}) =>
  fetcher.state === `idle` && fetcher.data?.saved && isFormValid ? (
    <Notice kind='status'>{children}</Notice>
  ) : null
