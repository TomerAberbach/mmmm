import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

// An instant on the reader's clock. The server can't know the reader's time
// zone, so the text appears once the page hydrates
export const LocalTime = ({
  date,
  format,
}: {
  date: Date
  format: (date: Date) => string
}) => {
  const isHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  return (
    <time dateTime={date.toISOString()}>
      {isHydrated ? format(date) : null}
    </time>
  )
}
