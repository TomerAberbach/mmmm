import displayFont from '@fontsource/alfa-slab-one/files/alfa-slab-one-latin-400-normal.woff2?url'
import bodyFont from '@fontsource/barlow/files/barlow-latin-400-normal.woff2?url'
import type { ReactNode } from 'react'
import { RouterProvider } from 'react-aria-components'
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useHref,
  useNavigate,
  useRouteLoaderData,
} from 'react-router'
import type { Route } from './+types/root.ts'
import stylesheet from './app.css?url'
import { PageTitle } from './components/page-title.tsx'
import { SiteFooter } from './components/site-footer.tsx'
import { SiteHeader } from './components/site-header.tsx'
import { requireEnv } from './env.server.ts'
import { loadSignedInEducator, readSignedInEducator } from './session.server.ts'

export const links: Route.LinksFunction = () => [
  { rel: `stylesheet`, href: stylesheet },
  // Every page's first paint uses these, so they load alongside the stylesheet
  ...[displayFont, bodyFont].map(href => ({
    rel: `preload`,
    href,
    as: `font`,
    type: `font/woff2`,
    crossOrigin: `anonymous` as const,
  })),
]

export const middleware: Route.MiddlewareFunction[] = [loadSignedInEducator]

export const loader = async ({ context }: Route.LoaderArgs) => {
  const educator = await readSignedInEducator(context)
  return {
    supportEmail: requireEnv(`SUPPORT_EMAIL`),
    // Every page receives this, so it holds only what the header shows
    educator: educator && { name: educator.name },
  }
}

export const Layout = ({ children }: { children: ReactNode }) => {
  // Missing when the root loader itself failed
  const rootData = useRouteLoaderData<typeof loader>(`root`)
  const navigate = useNavigate()
  return (
    // Browser extensions, such as Browserpass, add attributes to <html> before
    // hydration
    <html lang='en' suppressHydrationWarning>
      <head>
        <meta charSet='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <Meta />
        {/* Stylesheets need no nonce. An empty one stops Links from using the
            router's, which only the server has, so hydration would mismatch.
            See https://github.com/remix-run/react-router/issues/15603 */}
        <Links nonce='' />
      </head>
      <body className='flex min-h-screen flex-col'>
        {/* React Aria links navigate through the router */}
        <RouterProvider
          navigate={(href, options) => void navigate(href, options)}
          useHref={useHref}
        >
          <SiteHeader educator={rootData?.educator} />
          <main className='mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6'>
            {children}
          </main>
          <SiteFooter supportEmail={rootData?.supportEmail} />
        </RouterProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

const App = () => <Outlet />
export default App

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
  const heading =
    isRouteErrorResponse(error) && error.status === 404
      ? `Page not found`
      : `Something went wrong`
  return (
    <div className='flex flex-col gap-4'>
      <PageTitle>{heading}</PageTitle>
      <Link to='/' className='font-semibold'>
        Go to the home page
      </Link>
      {import.meta.env.DEV && error instanceof Error ? (
        <pre className='overflow-x-auto'>
          <code>{error.stack}</code>
        </pre>
      ) : null}
    </div>
  )
}
