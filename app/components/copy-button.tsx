import { useEffect, useRef, useState } from 'react'
import { Button } from './button.tsx'
import { StableLabel } from './stable-label.tsx'

type CopyState = `idle` | `copied` | `failed`

const LABELS: Record<CopyState, string> = {
  idle: `Copy link`,
  copied: `Copied`,
  failed: `Couldn’t copy`,
}

const ANNOUNCEMENTS: Record<CopyState, string> = {
  idle: ``,
  copied: `Copied the link`,
  failed: `Couldn’t copy the link`,
}

// Copies `text`, then shows the result for 2 seconds, as Primer's copy pattern
// does. Screen readers hear the result, since they don't read a label change
export const CopyButton = ({
  text,
  variant = `primary`,
  'aria-label': ariaLabel,
}: {
  text: string
  variant?: `primary` | `quiet`
  'aria-label'?: string
}) => {
  const [state, show] = useTemporaryState<CopyState>(`idle`, 2000)
  const copy = async () => {
    try {
      // Runs only in the browser, so Node's support doesn't apply
      // eslint-disable-next-line node/no-unsupported-features/node-builtins
      await navigator.clipboard.writeText(text)
      show(`copied`)
    } catch {
      show(`failed`)
    }
  }
  return (
    <>
      <Button
        variant={variant}
        onPress={() => void copy()}
        aria-label={ariaLabel}
      >
        <StableLabel labels={Object.values(LABELS)} shown={LABELS[state]} />
      </Button>
      <span className='sr-only' aria-live='polite'>
        {ANNOUNCEMENTS[state]}
      </span>
    </>
  )
}

// A state that returns to `resting` once `durationMs` passes. Each `show`
// restarts the wait, even when the value repeats
const useTemporaryState = <State,>(
  resting: State,
  durationMs: number,
): [State, (value: State) => void] => {
  const [state, setState] = useState(resting)
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timeout.current), [])
  const show = (value: State) => {
    setState(value)
    clearTimeout(timeout.current)
    timeout.current = setTimeout(() => setState(resting), durationMs)
  }
  return [state, show]
}
