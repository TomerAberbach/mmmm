import { PassThrough } from 'node:stream'
import { createReadableStreamFromReadable } from '@react-router/node'
import { isbot } from 'isbot'
import { renderToPipeableStream } from 'react-dom/server'
import type { RenderToPipeableStreamOptions } from 'react-dom/server'
import { ServerRouter } from 'react-router'
import type { EntryContext, RouterContextProvider } from 'react-router'
import { nonceContext } from './nonce.ts'

export const streamTimeout = 5000

const handleRequest = async (
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: RouterContextProvider,
): Promise<Response> => {
  // https://httpwg.org/specs/rfc9110.html#HEAD
  if (request.method.toUpperCase() === `HEAD`) {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders,
    })
  }

  const nonce = loadContext.get(nonceContext)
  const userAgent = request.headers.get(`user-agent`)
  // Bots and SPA mode wait for all content so the response is complete
  const readyOption: keyof RenderToPipeableStreamOptions =
    (userAgent && isbot(userAgent)) || routerContext.isSpaMode
      ? `onAllReady`
      : `onShellReady`

  return new Promise((resolve, reject) => {
    let shellRendered = false
    let statusCode = responseStatusCode
    // Abort after `streamTimeout` so rejected boundaries have time to flush
    let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(
      () => abort(),
      streamTimeout + 1000,
    )

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
      {
        nonce,
        [readyOption]: () => {
          shellRendered = true
          const body = new PassThrough({
            final: callback => {
              clearTimeout(timeoutId)
              timeoutId = undefined
              callback()
            },
          })
          responseHeaders.set(`Content-Type`, `text/html`)
          pipe(body)
          resolve(
            new Response(createReadableStreamFromReadable(body), {
              headers: responseHeaders,
              status: statusCode,
            }),
          )
        },
        onShellError: (error: unknown) => {
          clearTimeout(timeoutId)
          reject(error instanceof Error ? error : new Error(String(error)))
        },
        onError: (error: unknown) => {
          statusCode = 500
          // React Router logs errors from the shell when the promise rejects
          if (shellRendered) {
            console.error(error)
          }
        },
      },
    )
  })
}
export default handleRequest
