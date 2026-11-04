import { parseSetCookieHeader } from 'better-auth/cookies'
import { createContext, data, href, redirect } from 'react-router'
import type { MiddlewareFunction, RouterContextProvider } from 'react-router'
import { isAdmin } from './admins.server.ts'
import { auth } from './auth.server.ts'
import type { SessionAssurance } from './generated/prisma/enums.ts'
import { readAssurance } from './second-factor.server.ts'

export type SignedInEducator = {
  id: string
  name: string
  email: string
  emailVerified: boolean
}

export type SignedInSession = { id: string; assurance: SessionAssurance }

type SignedIn = { educator: SignedInEducator; session: SignedInSession }

type SessionLookup = { signedIn: SignedIn | null; headers: Headers }

const signedInContext = createContext<() => Promise<SignedIn | null>>()

// Looks up the session at most once per request, and only when
// `readSignedInEducator` runs or `requireSignedInEducator` needs it
export const loadSignedInEducator: MiddlewareFunction<Response> = async (
  { request, context },
  next,
) => {
  let lookup: Promise<SessionLookup> | undefined
  context.set(signedInContext, async () => {
    lookup ??= auth.api
      .getSession({ headers: request.headers, returnHeaders: true })
      .then(({ headers, response }) => ({
        headers,
        signedIn: response && toSignedIn(response),
      }))
    return (await lookup).signedIn
  })

  const response = await next()
  // The lookup sets cookies that extend a session due for renewal, or clear an
  // expired one. A failed lookup already reached the loader or action that
  // read it
  const lookupHeaders = await lookup?.then(
    ({ headers }) => headers,
    () => undefined,
  )
  if (lookupHeaders) {
    appendCookiesNotSet(response.headers, lookupHeaders)
  }
  return response
}

type BetterAuthSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>

const toSignedIn = ({ user, session }: BetterAuthSession): SignedIn => ({
  educator: {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
  },
  session: { id: session.id, assurance: readAssurance(session) },
})

export const readSignedInEducator = async (
  context: Readonly<RouterContextProvider>,
): Promise<SignedInEducator | null> =>
  (await context.get(signedInContext)())?.educator ?? null

const requiredContext = createContext<SignedIn>()

// Sends signed-out visitors to sign in. Routes below it read the educator with
// `readRequiredEducator`, and the session with `readRequiredSession`
export const requireSignedInEducator: MiddlewareFunction<Response> = async (
  { context },
  next,
) => {
  const signedIn = await context.get(signedInContext)()
  if (!signedIn) {
    return redirect(href(`/sign-in`))
  }
  context.set(requiredContext, signedIn)
  return next()
}

// Sends a signed-in educator to their dashboard, away from the pages that sign
// in or sign up
export const requireSignedOut: MiddlewareFunction<Response> = async (
  { context },
  next,
) =>
  (await context.get(signedInContext)()) ? redirect(href(`/contests`)) : next()

export const readRequiredEducator = (
  context: Readonly<RouterContextProvider>,
): SignedInEducator => context.get(requiredContext).educator

export const readRequiredSession = (
  context: Readonly<RouterContextProvider>,
): SignedInSession => context.get(requiredContext).session

// Answers anyone but an admin with the not-found page, so the admin area looks
// like any missing page. Nest it after `requireSignedInEducator`
export const requireAdmin: MiddlewareFunction<Response> = async (
  { context },
  next,
) => {
  if (!isAdmin(readRequiredEducator(context))) {
    // React Router renders a thrown response with the error page
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw data(null, { status: 404 })
  }
  return next()
}

const appendCookiesNotSet = (target: Headers, source: Headers): void => {
  const namesSet = new Set(target.getSetCookie().map(cookieName))
  for (const setCookie of source.getSetCookie()) {
    if (!namesSet.has(cookieName(setCookie))) {
      target.append(`set-cookie`, setCookie)
    }
  }
}

const cookieName = (setCookie: string): string | undefined =>
  parseSetCookieHeader(setCookie).keys().next().value
