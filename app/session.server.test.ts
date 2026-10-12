import { RouterContextProvider } from 'react-router'
import { expect, test, vi } from 'vitest'
import { auth } from './auth.server.ts'
import { loadSignedInEducator, readSignedInEducator } from './session.server.ts'

const stubSession = (setCookies: string[] = []) => {
  const headers = new Headers()
  for (const setCookie of setCookies) {
    headers.append(`set-cookie`, setCookie)
  }
  return vi.spyOn(auth.api, `getSession`).mockResolvedValue({
    headers,
    response: { user: { name: `Ms. Frizzle` } },
  } as never)
}

// Runs the middleware around a handler, which plays the loaders and actions
const runRequest = async (
  handler: (context: RouterContextProvider) => Promise<Response>,
): Promise<Response> => {
  const context = new RouterContextProvider()
  return (await loadSignedInEducator(
    {
      request: new Request(`http://localhost/`),
      context,
      params: {},
      unstable_pattern: `/`,
    } as never,
    () => handler(context),
  )) as Response
}

test(`a request that never asks for the educator never looks up the session`, async () => {
  const getSession = stubSession()

  await runRequest(() => Promise.resolve(new Response()))

  expect(getSession).not.toHaveBeenCalled()
})

test(`loaders that ask for the educator share one lookup`, async () => {
  const getSession = stubSession()

  await runRequest(async context => {
    const educators = await Promise.all([
      readSignedInEducator(context),
      readSignedInEducator(context),
    ])
    expect(educators).toStrictEqual([
      { name: `Ms. Frizzle` },
      { name: `Ms. Frizzle` },
    ])
    return new Response()
  })

  expect(getSession).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ returnHeaders: true }),
  )
})

test(`a renewed session cookie goes on the response`, async () => {
  stubSession([`session=renewed; Path=/`])

  const response = await runRequest(async context => {
    await readSignedInEducator(context)
    return new Response()
  })

  expect(response.headers.getSetCookie()).toStrictEqual([
    `session=renewed; Path=/`,
  ])
})

test(`a cookie the response sets wins over the renewed one`, async () => {
  stubSession([`session=renewed; Path=/`])

  const response = await runRequest(async context => {
    await readSignedInEducator(context)
    return new Response(null, {
      headers: { 'set-cookie': `session=; Max-Age=0; Path=/` },
    })
  })

  expect(response.headers.getSetCookie()).toStrictEqual([
    `session=; Max-Age=0; Path=/`,
  ])
})
