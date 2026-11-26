/** The code of a refusal whose message the app wrote for educators */
export const APP_REFUSAL = `APP_REFUSAL`

/**
 * The message of an error body that `refuse` made, or undefined for one of
 * Better Auth's own
 */
export const readRefusalMessage = (body: unknown): string | undefined => {
  if (typeof body !== `object` || body === null) {
    return undefined
  }
  const { code, message } = body as { code?: unknown; message?: unknown }
  return code === APP_REFUSAL && typeof message === `string`
    ? message
    : undefined
}
