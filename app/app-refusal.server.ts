import { APIError } from 'better-auth/api'
import { APP_REFUSAL, readRefusalMessage } from './app-refusal.ts'

/** An error for a Better Auth request, whose message pages show as written */
export const refuse = (
  status: ConstructorParameters<typeof APIError>[0],
  message: string,
  headers?: HeadersInit,
): APIError => new APIError(status, { code: APP_REFUSAL, message }, headers)

/** The message of an error `refuse` made, or undefined for any other */
export const readRefusal = (error: unknown): string | undefined =>
  error instanceof APIError ? readRefusalMessage(error.body) : undefined
