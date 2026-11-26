import { auth } from './auth.server.ts'

/**
 * What browsers call, and what emailed links open. The app's routes call the
 * rest of Better Auth in process, after their own checks
 */
const PUBLIC_ENDPOINTS: readonly RegExp[] = [
  /^GET \/api\/auth\/passkey\/generate-register-options$/v,
  /^POST \/api\/auth\/passkey\/verify-registration$/v,
  /^GET \/api\/auth\/passkey\/generate-authenticate-options$/v,
  /^POST \/api\/auth\/passkey\/verify-authentication$/v,
  /^GET \/api\/auth\/verify-email$/v,
  /^GET \/api\/auth\/reset-password\/[^\/]+$/v,
]

/** Answers a request for any other endpoint as not found */
export const answerAuthRequest = async (
  request: Request,
): Promise<Response> => {
  const endpoint = `${request.method} ${new URL(request.url).pathname}`
  return PUBLIC_ENDPOINTS.some(pattern => pattern.test(endpoint))
    ? auth.handler(request)
    : new Response(null, { status: 404 })
}
