import { href } from 'react-router'

/**
 * Why the server sent a form's submission away instead of saving it, or
 * undefined for any other error. A client action that answers with this keeps
 * what the admin typed on the page
 */
export const readLostSessionMessage = (error: unknown): string | undefined => {
  if (!(error instanceof Response)) {
    return undefined
  }
  switch (error.headers.get(`Location`)) {
    case href(`/admin/verify`):
    case href(`/admin/setup`):
      return `The admin area needs your second factor again. Open the admin area in another tab, use your second factor there, then save here again`
    case href(`/sign-in`):
      return `You’re signed out. Sign in again in another tab, then save here again`
    case null:
    default:
      return undefined
  }
}
