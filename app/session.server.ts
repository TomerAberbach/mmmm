import { parseSetCookieHeader } from 'better-auth/cookies'
import { createContext, redirect } from 'react-router'
import type { MiddlewareFunction, RouterContextProvider } from 'react-router'
import { auth } from './auth.server.ts'

export type SignedInEducator = { name: string }

type SessionLookup = { educator: SignedInEducator | null; headers: Headers }

const signedInEducatorContext =
  createContext<() => Promise<SignedInEducator | null>>()

// Looks up the session at most once per request, and only when
// `readSignedInEducator` runs
export const loadSignedInEducator: MiddlewareFunction<Response> = async (
  { request, context },
  next,
) => {
  let lookup: Promise<SessionLookup> | undefined
  context.set(signedInEducatorContext, async () => {
    lookup ??= auth.api
      .getSession({ headers: request.headers, returnHeaders: true })
      .then(({ headers, response: session }) => ({
        headers,
        educator: session ? { name: session.user.name } : null,
      }))
    return (await lookup).educator
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

export const readSignedInEducator = (
  context: Readonly<RouterContextProvider>,
): Promise<SignedInEducator | null> => context.get(signedInEducatorContext)()

const requiredEducatorContext = createContext<SignedInEducator>()

// Sends signed-out visitors to sign in. Routes below it read the educator with
// `readRequiredEducator`
export const requireSignedInEducator: MiddlewareFunction<Response> = async (
  { context },
  next,
) => {
  const educator = await readSignedInEducator(context)
  if (!educator) {
    return redirect(`/sign-in`)
  }
  context.set(requiredEducatorContext, educator)
  return next()
}

export const readRequiredEducator = (
  context: Readonly<RouterContextProvider>,
): SignedInEducator => context.get(requiredEducatorContext)

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
