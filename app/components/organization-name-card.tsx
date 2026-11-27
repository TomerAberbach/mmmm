import { getFormProps } from '@conform-to/react'
import { href, useFetcher } from 'react-router'
import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
import { FormError } from './form-error.tsx'
import { Notice } from './notice.tsx'
import { useIsJustSaved } from './saved-notice.tsx'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { freeTextSchema } from '~/free-text.ts'
import { organizationNameSchema } from '~/organization-forms.ts'
import type { Organization } from '~/organizations.ts'

const ORGANIZATION_NAME_SCHEMA = organizationNameSchema(freeTextSchema)

/** Asks for the name of an organization that has none, then says it saved */
export const OrganizationNameCard = ({
  organization: { domain, name },
}: {
  organization: Organization
}) => {
  const fetcher = useFetcher<SavedResult>()
  const isJustSaved = useIsJustSaved(fetcher)
  if (name === null) {
    return <NameForm domain={domain} fetcher={fetcher} />
  }
  return isJustSaved ? (
    <div ref={focusOnMount} tabIndex={-1} className='outline-none'>
      <Notice kind='status'>Saved your organization’s name</Notice>
    </div>
  ) : null
}

/** The form took focus with it */
const focusOnMount = (element: HTMLElement | null) => {
  element?.focus()
}

const NameForm = ({
  domain,
  fetcher,
}: {
  domain: string
  fetcher: FetcherWithComponents<SavedResult>
}) => {
  const { form, fields } = useValidatedForm(
    ORGANIZATION_NAME_SCHEMA,
    fetcher.data?.result,
  )
  return (
    <section className='flex flex-col gap-3 border-2 border-ink p-5'>
      <h2 className={SECTION_HEADING_CLASS_NAME}>Name your organization</h2>
      <p className='max-w-prose'>
        {`You’re with everyone whose email address ends in `}
        <strong>{domain}</strong>, and your contests share a leaderboard. No one
        has named it yet.
      </p>
      <fetcher.Form
        method='post'
        action={href(`/contests/organization`)}
        {...getFormProps(form)}
        className='flex max-w-xl flex-col gap-4'
      >
        <TextField
          {...fieldProps(fields.name)}
          label='Organization name'
          description='The name your players know, such as Springfield High School'
          autoComplete='organization'
        />
        <div>
          <Button type='submit' isPending={fetcher.state !== `idle`}>
            Save name
          </Button>
        </div>
        <FormError form={form} />
      </fetcher.Form>
    </section>
  )
}
