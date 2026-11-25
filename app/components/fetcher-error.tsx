import type { FetcherWithComponents } from 'react-router'
import type { ConfirmResult } from './confirm-dialog.tsx'

/** A ConfirmResult's error, once its request finishes */
export const FetcherError = ({
  fetcher,
}: {
  fetcher: FetcherWithComponents<ConfirmResult>
}) =>
  fetcher.state === `idle` && fetcher.data && `error` in fetcher.data ? (
    <p role='alert' className='mt-1 font-semibold text-danger'>
      {fetcher.data.error}
    </p>
  ) : null
