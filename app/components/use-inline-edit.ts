import { useState } from 'react'
import { useFetcher } from 'react-router'
import type { FetcherWithComponents } from 'react-router'
import { isSaved } from './saved-notice.tsx'
import type { SavedResult } from '~/form-replies.server.ts'

/**
 * An editor that a press opens and that closes on cancel or once its save
 * succeeds. Opening clears the last save, so the editor starts afresh
 */
export const useInlineEdit = (): {
  fetcher: FetcherWithComponents<SavedResult>
  isOpen: boolean
  isSaved: boolean
  open: () => void
  close: () => void
} => {
  const [isEditing, setIsEditing] = useState(false)
  const fetcher = useFetcher<SavedResult>()
  const saved = isSaved(fetcher)
  return {
    fetcher,
    isOpen: isEditing && !saved,
    isSaved: saved,
    open: () => {
      fetcher.reset()
      setIsEditing(true)
    },
    close: () => setIsEditing(false),
  }
}
