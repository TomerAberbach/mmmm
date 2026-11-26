import type { FetcherWithComponents } from 'react-router'
import type { ConfirmResult } from './confirm-dialog.tsx'

/** A ConfirmResult's error, once its request finishes */
export const FetcherError = ({
  fetcher,
  subject,
}: {
  fetcher: FetcherWithComponents<ConfirmResult>
  /** What the error is about, where the page doesn't show it */
  subject?: string
}) =>
  fetcher.state === `idle` && fetcher.data && `error` in fetcher.data ? (
    <p role='alert' className='mt-1 font-semibold text-danger'>
      {subject === undefined ? null : `${subject}: `}
      {fetcher.data.error}
    </p>
  ) : null
