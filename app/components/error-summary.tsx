import { useField } from '@conform-to/react'
import { useId } from 'react'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'

// Lists a long form's errors above it, each linking to its field, as the
// GOV.UK error summary does. Each field still shows its own error. It isn't a
// live region, since it changes on every keystroke once the form revalidates,
// and the form already moves focus to the first invalid field. Render it
// inside the form's FormProvider
export const ErrorSummary = ({
  errors,
}: {
  // Each field's Conform name with its error
  errors: { name: string; message: string }[]
}) => {
  const headingId = useId()
  return errors.length > 0 ? (
    <section
      aria-labelledby={headingId}
      className='flex max-w-3xl flex-col gap-2 border-4 border-danger px-5 py-4'
    >
      <h2 id={headingId} className={SECTION_HEADING_CLASS_NAME}>
        Fix these to save
      </h2>
      <ul className='flex list-disc flex-col gap-1 ps-5'>
        {errors.map(({ name, message }) => (
          <li key={`${name}:${message}`}>
            <ErrorLink name={name} message={message} />
          </li>
        ))}
      </ul>
    </section>
  ) : null
}

const ErrorLink = ({ name, message }: { name: string; message: string }) => {
  const [field] = useField(name)
  return (
    <a
      href={`#${field.id}`}
      className='font-semibold text-danger underline underline-offset-2'
    >
      {message}
    </a>
  )
}
