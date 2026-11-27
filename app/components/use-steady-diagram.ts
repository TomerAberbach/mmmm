import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * Keeps the diagram in place in the window as content above it comes and goes,
 * by scrolling as far as it moves, once focus reaches the bar or anything after
 * it. Scroll anchoring does the same in some browsers, though not at the top of
 * the page, so `app.css` turns it off
 */
export const useSteadyDiagram = (): {
  barRef: RefObject<HTMLDivElement | null>
  diagramRef: RefObject<HTMLDivElement | null>
} => {
  const barRef = useRef<HTMLDivElement>(null)
  const diagramRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const bar = barRef.current!
    const diagram = diagramRef.current!
    let last = measure(diagram)
    let isSteady = false
    const trackFocus = ({ target }: FocusEvent): void => {
      isSteady =
        (bar.compareDocumentPosition(target as Node) &
          Node.DOCUMENT_POSITION_PRECEDING) ===
        0
    }
    // Observers run before the browser paints the change
    const observer = new ResizeObserver(() => {
      const next = measure(diagram)
      // Resizing the window moves the diagram for another reason
      if (isSteady && next.width === last.width && next.top !== last.top) {
        globalThis.scrollBy({ top: next.top - last.top, behavior: `instant` })
      }
      last = measure(diagram)
    })
    observer.observe(document.body)
    document.addEventListener(`focusin`, trackFocus)
    return () => {
      observer.disconnect()
      document.removeEventListener(`focusin`, trackFocus)
    }
  }, [])
  return { barRef, diagramRef }
}

/** The diagram's top in the document, which scrolling leaves as it is */
const measure = (diagram: HTMLElement): { top: number; width: number } => ({
  top: diagram.getBoundingClientRect().top + globalThis.scrollY,
  width: document.documentElement.clientWidth,
})
