import { getFormProps } from '@conform-to/react'
import type { SubmissionResult } from '@conform-to/react'
import {
  Button as AriaButton,
  Disclosure,
  DisclosurePanel,
  Heading,
} from 'react-aria-components'
import { Form } from 'react-router'
import { confirmPasswordSchema, securityCodeFormSchema } from '../auth-forms.ts'
import { Button } from './button.tsx'
import { FormError } from './form-error.tsx'
import { PageTitle } from './page-title.tsx'
import { QrCode } from './qr-code.tsx'
import { SecurityCodeField } from './security-code-field.tsx'
import { fieldProps, PasswordField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'

const TITLE = `Set up your authenticator app`

// Better Auth asks for the password before it makes the app's secret
export const ConfirmPasswordStep = ({
  lastResult,
}: {
  lastResult?: SubmissionResult
}) => {
  const { form, fields, isSubmitting } = useValidatedForm(
    confirmPasswordSchema,
    lastResult,
  )
  return (
    <div className='flex max-w-md flex-col gap-6'>
      <PageTitle>{TITLE}</PageTitle>
      <p>Enter your password to start.</p>
      <Form
        method='post'
        {...getFormProps(form)}
        className='flex flex-col gap-5'
      >
        <input type='hidden' name='intent' value='start' />
        <PasswordField
          key={fields.password.key}
          {...fieldProps(fields.password)}
          label='Password'
          autoComplete='current-password'
        />
        <div>
          <Button type='submit' isPending={isSubmitting}>
            Continue
          </Button>
        </div>
        <FormError form={form} />
      </Form>
    </div>
  )
}

export const ScanStep = ({
  totpUri,
  lastResult,
}: {
  totpUri: string
  lastResult?: SubmissionResult
}) => {
  const { form, fields, isSubmitting } = useValidatedForm(
    securityCodeFormSchema,
    lastResult,
  )
  return (
    <div className='flex max-w-md flex-col gap-6'>
      <PageTitle>{TITLE}</PageTitle>
      <p>
        Scan this QR code with your authenticator app, then enter the code it
        shows.
      </p>
      <QrCode value={totpUri} label='QR code for your authenticator app' />
      <Disclosure className='flex flex-col gap-2'>
        <Heading>
          <AriaButton
            slot='trigger'
            className='cursor-pointer font-semibold text-accent-strong underline underline-offset-2 outline-offset-2 data-focus-visible:outline-3 data-focus-visible:outline-accent-strong'
          >
            Can&apos;t scan it?
          </AriaButton>
        </Heading>
        <DisclosurePanel className='flex flex-col gap-1'>
          <p>Enter this key in your app instead:</p>
          <p className='font-mono tracking-wide break-all'>
            {formatKey(readSecret(totpUri))}
          </p>
        </DisclosurePanel>
      </Disclosure>
      <Form
        method='post'
        {...getFormProps(form)}
        className='flex flex-col gap-5'
      >
        <input type='hidden' name='intent' value='turn-on' />
        <input type='hidden' name='totpUri' value={totpUri} />
        <SecurityCodeField {...fieldProps(fields.code)} />
        <div>
          <Button type='submit' isPending={isSubmitting}>
            Turn on
          </Button>
        </div>
        <FormError form={form} />
      </Form>
    </div>
  )
}

const readSecret = (totpUri: string): string =>
  new URL(totpUri).searchParams.get(`secret`) ?? ``

// Groups of 4, as apps show their own keys
const formatKey = (secret: string): string =>
  secret.match(/.{1,4}/gu)?.join(` `) ?? secret
