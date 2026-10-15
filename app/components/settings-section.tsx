import { useId } from 'react'
import type { ReactNode } from 'react'

export const SECTION_HEADING_CLASS_NAME = `font-condensed text-2xl leading-tight font-extrabold uppercase`

export const SettingsSection = ({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) => {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className='flex flex-col gap-4 py-8 first:pt-0'
    >
      <h2 id={headingId} className={SECTION_HEADING_CLASS_NAME}>
        {title}
      </h2>
      {children}
    </section>
  )
}
