import { useId } from 'react'
import type { ReactNode, Ref } from 'react'

export const SECTION_HEADING_CLASS_NAME = `font-condensed text-2xl leading-tight font-extrabold uppercase`

export const SettingsSection = ({
  title,
  ref,
  children,
}: {
  title: string
  /** Lets the section take focus from code */
  ref?: Ref<HTMLElement>
  children: ReactNode
}) => {
  const headingId = useId()
  return (
    <section
      ref={ref}
      tabIndex={ref ? -1 : undefined}
      aria-labelledby={headingId}
      className='flex flex-col gap-4 py-8 outline-none first:pt-0'
    >
      <h2 id={headingId} className={SECTION_HEADING_CLASS_NAME}>
        {title}
      </h2>
      {children}
    </section>
  )
}
