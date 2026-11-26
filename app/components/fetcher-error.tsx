import type { FetcherWithComponents } from 'react-router'

/** The error an action answered, once its request finishes */
export const FetcherError = ({
  fetcher,
  subject,
}: {
  fetcher: Pick<FetcherWithComponents<object>, `state` | `data`>
  /** What the error is about, where the page doesn't show it */
  subject?: string
}) =>
  fetcher.state === `idle` &&
  fetcher.data &&
  `error` in fetcher.data &&
  typeof fetcher.data.error === `string` ? (
    <p role='alert' className='mt-1 font-semibold text-danger'>
      {subject === undefined ? null : `${subject}: `}
      {fetcher.data.error}
    </p>
  ) : null
