import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'
import { readRefusalMessage } from './app-refusal.ts'

/**
 * Resolves to an error message, or undefined once the ceremony succeeds. The
 * browser rejects the ceremony when the educator cancels it
 */
export type PasskeyCeremony = () => Promise<string | undefined>

export const addPasskey: PasskeyCeremony = () =>
  runCeremony(`The passkey wasn’t added. Try again`, async () => {
    const options = await fetchJson<PublicKeyCredentialCreationOptionsJSON>(
      `/api/auth/passkey/generate-register-options`,
    )
    const response = await startRegistration({ optionsJSON: options })
    await fetchJson(`/api/auth/passkey/verify-registration`, { response })
  })

export const signInWithPasskey: PasskeyCeremony = () =>
  runCeremony(
    `That didn’t sign you in. Try again, or use your password`,
    authenticate,
  )

/** For a signed-in educator, whose password can't stand in for the passkey */
export const verifyPasskey: PasskeyCeremony = () =>
  runCeremony(`Your passkey wasn’t accepted. Try again`, authenticate)

const authenticate = async (): Promise<void> => {
  const options = await fetchJson<PublicKeyCredentialRequestOptionsJSON>(
    `/api/auth/passkey/generate-authenticate-options`,
  )
  const response = await startAuthentication({ optionsJSON: options })
  await fetchJson(`/api/auth/passkey/verify-authentication`, { response })
}

const runCeremony = async (
  fallbackMessage: string,
  run: () => Promise<void>,
): Promise<string | undefined> => {
  try {
    await run()
    return undefined
  } catch (error) {
    return error instanceof RefusalError ? error.message : fallbackMessage
  }
}

/** A refusal whose message the app wrote */
class RefusalError extends Error {
  public override readonly name = `RefusalError`
}

const fetchJson = async <Result>(
  url: string,
  body?: unknown,
): Promise<Result> => {
  const response = await fetch(
    url,
    body === undefined
      ? {}
      : {
          method: `POST`,
          headers: { 'content-type': `application/json` },
          body: JSON.stringify(body),
        },
  )
  const json: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message = readRefusalMessage(json)
    throw message ? new RefusalError(message) : new Error(response.statusText)
  }
  return json as Result
}
