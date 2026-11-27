import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
import { Notice } from './notice.tsx'

type ErrorFetcher = Pick<FetcherWithComponents<object>, `state` | `data`>

/** The error an action answered, once its request finishes */
export const FetcherError = ({
  fetcher,
  subject,
}: {
  fetcher: ErrorFetcher
  /** What the error is about, where the page doesn't show it */
  subject?: string
}) => {
  const error = readError(fetcher)
  return error ? (
    <p role='alert' className='mt-1 font-semibold text-danger'>
      {subject === undefined ? null : `${subject}: `}
      <ErrorText error={error} />
    </p>
  ) : null
}

/**
 * Like `FetcherError`, in a dialog. Goes below the buttons, so they stay put
 * when it appears
 */
export const DialogError = ({ fetcher }: { fetcher: ErrorFetcher }) => {
  const error = readError(fetcher)
  return error ? (
    <Notice kind='alert'>
      <ErrorText error={error} />
    </Notice>
  ) : null
}

type ActionError = { message: string; isStale: boolean }

const ErrorText = ({ error: { message, isStale } }: { error: ActionError }) => (
  <>
    {message}
    {isStale ? <ReloadButton /> : null}
  </>
)

const readError = ({ state, data }: ErrorFetcher): ActionError | null =>
  state === `idle` && data && `error` in data && typeof data.error === `string`
    ? { message: data.error, isStale: `isStale` in data }
    : null

const ReloadButton = () => (
  <Button variant='quiet' onPress={() => location.reload()}>
    Reload
  </Button>
)
