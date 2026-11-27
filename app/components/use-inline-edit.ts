import { useCallback, useRef, useState } from 'react'
import type { RefCallback } from 'react'
import { useFetcher } from 'react-router'
import type { FetcherWithComponents } from 'react-router'
import { isSaved, useIsJustSaved } from './saved-notice.tsx'
import type { SavedResult } from '~/form-replies.server.ts'

/**
 * An editor that a press opens and that closes on cancel or once its save
 * succeeds. Opening clears the last save, so the editor starts afresh. Closing
 * returns focus to the button that opens it
 */
export const useInlineEdit = (): {
  fetcher: FetcherWithComponents<SavedResult>
  isOpen: boolean
  /** Whether to say that it saved, until a later action */
  isSaved: boolean
  /** For the button that opens the editor, rendered only while it's closed */
  buttonRef: RefCallback<HTMLButtonElement>
  open: () => void
  close: () => void
} => {
  const [isEditing, setIsEditing] = useState(false)
  const fetcher = useFetcher<SavedResult>()
  const saved = isSaved(fetcher)
  const isJustSaved = useIsJustSaved(fetcher)
  const hasOpened = useRef(false)
  const buttonRef = useCallback((button: HTMLButtonElement | null) => {
    // The editor took focus with it, unless focus had moved elsewhere
    if (
      button &&
      hasOpened.current &&
      document.activeElement === document.body
    ) {
      button.focus()
    }
  }, [])
  return {
    fetcher,
    isOpen: isEditing && !saved,
    isSaved: isJustSaved,
    buttonRef,
    open: () => {
      fetcher.reset()
      hasOpened.current = true
      setIsEditing(true)
    },
    close: () => setIsEditing(false),
  }
}
