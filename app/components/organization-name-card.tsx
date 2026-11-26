import { getFormProps } from '@conform-to/react'
import { href, useFetcher } from 'react-router'
import { Button } from './button.tsx'
import { FormError } from './form-error.tsx'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { freeTextSchema } from '~/free-text.ts'
import { organizationNameSchema } from '~/organization-forms.ts'

const ORGANIZATION_NAME_SCHEMA = organizationNameSchema(freeTextSchema)

/** Asks for the name of an organization that has none */
export const OrganizationNameCard = ({ domain }: { domain: string }) => {
  const fetcher = useFetcher<SavedResult>()
  const { form, fields } = useValidatedForm(
    ORGANIZATION_NAME_SCHEMA,
    fetcher.data?.result,
  )
  return (
    <section className='flex flex-col gap-3 border-2 border-ink p-5'>
      <h2 className={SECTION_HEADING_CLASS_NAME}>Name your organization</h2>
      <p className='max-w-prose'>
        {`You’re with everyone whose email ends in `}
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
