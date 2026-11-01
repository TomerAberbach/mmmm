import { getFormProps } from '@conform-to/react'
import { useFetcher } from 'react-router'
import {
  changePasswordSchema,
  MIN_PASSWORD_LENGTH,
  nameSchema,
} from '../auth-forms.ts'
import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import type { ConfirmResult } from './confirm-dialog.tsx'
import { Notice } from './notice.tsx'
import { PageTitle } from './page-title.tsx'
import { SavedNotice } from './saved-notice.tsx'
import type { SavedResult } from './saved-notice.tsx'
import { SecondFactorSettings } from './second-factor-settings.tsx'
import type { SecondFactorSettingsData } from './second-factor-settings.tsx'
import { SettingsSection } from './settings-section.tsx'
import { fieldProps, PasswordField, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'

export const EducatorSettings = ({
  name,
  secondFactors,
}: {
  name: string
  // Only for admins and educators who have a second factor
  secondFactors?: SecondFactorSettingsData
}) => (
  <div className='flex max-w-md flex-col gap-8'>
    <PageTitle>Account settings</PageTitle>
    <div className='flex flex-col divide-y-2 divide-ink'>
      <NameSettings name={name} />
      <PasswordSettings />
      <SessionSettings />
      {secondFactors ? <SecondFactorSettings {...secondFactors} /> : null}
    </div>
  </div>
)

const NameSettings = ({ name }: { name: string }) => {
  const fetcher = useFetcher<SavedResult>()
  const { form, fields } = useValidatedForm(nameSchema, fetcher.data?.result)
  return (
    <SettingsSection title='Name'>
      <fetcher.Form
        method='post'
        action='/settings/name'
        {...getFormProps(form)}
        className='flex flex-col gap-5'
      >
        <TextField
          {...fieldProps(fields.name)}
          defaultValue={fields.name.initialValue ?? name}
          label='Full name'
          description='Players see this name on your contest links'
          autoComplete='name'
        />
        <div>
          <Button type='submit' isPending={fetcher.state !== `idle`}>
            Save name
          </Button>
        </div>
        <SavedNotice fetcher={fetcher} isFormValid={form.valid}>
          Your name is saved.
        </SavedNotice>
      </fetcher.Form>
    </SettingsSection>
  )
}

const PasswordSettings = () => {
  const fetcher = useFetcher<SavedResult>()
  const { form, fields } = useValidatedForm(
    changePasswordSchema,
    fetcher.data?.result,
  )
  return (
    <SettingsSection title='Password'>
      <p className='text-muted'>
        Changing your password signs you out everywhere else. This browser stays
        signed in.
      </p>
      <fetcher.Form
        method='post'
        action='/settings/password'
        {...getFormProps(form)}
        className='flex flex-col gap-5'
      >
        <PasswordField
          key={fields.currentPassword.key}
          {...fieldProps(fields.currentPassword)}
          label='Current password'
          autoComplete='current-password'
        />
        <PasswordField
          key={fields.newPassword.key}
          {...fieldProps(fields.newPassword)}
          label='New password'
          description={`At least ${MIN_PASSWORD_LENGTH} characters`}
          autoComplete='new-password'
        />
        <div>
          <Button type='submit' isPending={fetcher.state !== `idle`}>
            Change password
          </Button>
        </div>
        <SavedNotice fetcher={fetcher} isFormValid={form.valid}>
          Your password is changed, and every other session is signed out. We
          emailed you about the change.
        </SavedNotice>
      </fetcher.Form>
    </SettingsSection>
  )
}

const SIGN_OUT_OTHERS_KEY = `sign-out-others`

const SessionSettings = () => {
  const signOut = useFetcher<ConfirmResult>({ key: SIGN_OUT_OTHERS_KEY })
  const signedOut =
    signOut.state === `idle` && signOut.data && `ok` in signOut.data
  return (
    <SettingsSection title='Sessions'>
      <p>
        Signed in on a shared or lost computer? Sign out everywhere except this
        browser.
      </p>
      <div>
        <ConfirmDialog
          trigger={<Button variant='secondary'>Sign out other sessions</Button>}
          title='Sign out other sessions?'
          confirmLabel='Sign out other sessions'
          action='/settings/sign-out-others'
          fetcherKey={SIGN_OUT_OTHERS_KEY}
        >
          Every browser and device signed in to your account, except this one,
          will need to sign in again.
        </ConfirmDialog>
      </div>
      {signedOut ? (
        <Notice kind='status'>Every other session is signed out.</Notice>
      ) : null}
    </SettingsSection>
  )
}
