import { getFormProps } from '@conform-to/react'
import type { SubmissionResult } from '@conform-to/react'
import type { ReactNode } from 'react'
import { href, Link, useFetcher } from 'react-router'
import { confirmPasswordSchema } from '../auth-forms.ts'
import { addPasskey } from '../passkeys.ts'
import type { SecondFactorSettingsData } from '../second-factor-settings.server.ts'
import { Button, ButtonLink } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { FormError } from './form-error.tsx'
import { Notice } from './notice.tsx'
import { PasskeyButton } from './passkey-button.tsx'
import { RecoveryCodeList } from './recovery-codes.tsx'
import { SettingsSection } from './settings-section.tsx'
import { fieldProps, PasswordField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'

export type AuthenticatorAppResult = {
  result: SubmissionResult
  recoveryCodes?: string[]
}

export const SecondFactorSettings = ({
  isAdmin,
  canChange,
  passkeys,
  recoveryCodesLeft,
}: SecondFactorSettingsData) => {
  const canAdd = isAdmin && canChange
  return (
    <SettingsSection title='Second factor'>
      {isAdmin ? (
        <p className='text-muted'>
          Admins need at least one to open the admin area.
        </p>
      ) : null}
      {canChange ? null : (
        <Notice kind='status'>
          {isAdmin ? (
            <>
              Open the <Link to={href(`/admin`)}>admin area</Link> and use your
              second factor before changing these.
            </>
          ) : (
            `Sign in with your passkey or authenticator app before changing these.`
          )}
        </Notice>
      )}
      <SettingsSubsection title='Passkeys'>
        {passkeys.length > 0 ? (
          <ul className='flex flex-col gap-3'>
            {passkeys.map(passkey => (
              <PasskeyItem
                key={passkey.id}
                {...passkey}
                canRemove={canChange}
              />
            ))}
          </ul>
        ) : (
          <p>No passkeys yet.</p>
        )}
        {canAdd ? (
          <PasskeyButton
            ceremony={addPasskey}
            successTo={href(`/settings`)}
            variant='secondary'
          >
            Add a passkey
          </PasskeyButton>
        ) : null}
      </SettingsSubsection>
      <SettingsSubsection title='Authenticator app'>
        {recoveryCodesLeft === undefined ? (
          <>
            <p>Off.</p>
            {canAdd ? (
              <div>
                <ButtonLink
                  href={href(`/admin/setup/authenticator-app`)}
                  variant='secondary'
                >
                  Set up an authenticator app
                </ButtonLink>
              </div>
            ) : null}
          </>
        ) : (
          <AuthenticatorAppSettings
            recoveryCodesLeft={recoveryCodesLeft}
            canChange={canChange}
          />
        )}
      </SettingsSubsection>
    </SettingsSection>
  )
}

const PasskeyItem = ({
  id,
  label,
  added,
  canRemove,
}: {
  id: string
  label: string
  added: string
  canRemove: boolean
}) => (
  <li className='flex flex-wrap items-center justify-between gap-3 border-b border-ink/20 pb-3'>
    <span>
      <strong>{label}</strong>
      <br />
      <span className='text-muted'>Added {added}</span>
    </span>
    {canRemove ? (
      <ConfirmDialog
        trigger={<Button variant='secondary'>Remove</Button>}
        title={`Remove this ${label === `Passkey` ? `passkey` : `${label} passkey`}?`}
        confirmLabel='Remove passkey'
        action={href(`/settings/remove-passkey`)}
        fields={{ id }}
      >
        You won&apos;t be able to sign in with it. We&apos;ll email you about
        the change.
      </ConfirmDialog>
    ) : null}
  </li>
)

// Better Auth asks for the password to turn the app off or to replace the
// recovery codes, so both share one password field
const AuthenticatorAppSettings = ({
  recoveryCodesLeft,
  canChange,
}: {
  recoveryCodesLeft: number
  canChange: boolean
}) => {
  const fetcher = useFetcher<AuthenticatorAppResult>()
  const { form, fields } = useValidatedForm(
    confirmPasswordSchema,
    fetcher.data?.result,
  )
  const isIdle = fetcher.state === `idle`
  const recoveryCodes = isIdle ? fetcher.data?.recoveryCodes : undefined
  return (
    <>
      <p>
        On. {recoveryCodesLeft} recovery{` `}
        {recoveryCodesLeft === 1 ? `code` : `codes`} left.
      </p>
      {recoveryCodes ? (
        <>
          <Notice kind='status'>
            Here are your new recovery codes. Your old ones no longer work. Save
            these now, since you won&apos;t see them again.
          </Notice>
          <RecoveryCodeList codes={recoveryCodes} />
        </>
      ) : null}
      {canChange ? (
        <fetcher.Form
          method='post'
          action={href(`/settings/authenticator-app`)}
          {...getFormProps(form)}
          className='flex flex-col gap-5'
        >
          <PasswordField
            key={fields.password.key}
            {...fieldProps(fields.password)}
            label='Password'
            description='To turn off the app or get new recovery codes'
            autoComplete='current-password'
          />
          <div className='flex flex-wrap gap-3'>
            <Button
              type='submit'
              name='intent'
              value='new-codes'
              variant='secondary'
              isPending={!isIdle}
            >
              Get new recovery codes
            </Button>
            <Button
              type='submit'
              name='intent'
              value='turn-off'
              variant='danger'
              isPending={!isIdle}
            >
              Turn off
            </Button>
          </div>
          <FormError form={form} />
        </fetcher.Form>
      ) : null}
    </>
  )
}

const SettingsSubsection = ({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) => (
  <div className='flex flex-col gap-3'>
    <h3 className='text-lg font-semibold'>{title}</h3>
    {children}
  </div>
)
