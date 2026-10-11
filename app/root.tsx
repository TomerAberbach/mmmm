import type { ReactNode } from 'react'
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router'
import type { Route } from './+types/root.ts'
import stylesheet from './app.css?url'

export const links: Route.LinksFunction = () => [
  { rel: `stylesheet`, href: stylesheet },
]

export const Layout = ({ children }: { children: ReactNode }) => (
  // Browser extensions, such as Browserpass, add attributes to <html> before
  // hydration
  <html lang='en' suppressHydrationWarning>
    <head>
      <meta charSet='utf-8' />
      <meta name='viewport' content='width=device-width, initial-scale=1' />
      <Meta />
      {/* Stylesheets need no nonce. An empty one stops Links from using the
          router's, which only the server has, so hydration would mismatch. See
          https://github.com/remix-run/react-router/issues/15603 */}
      <Links nonce='' />
    </head>
    <body>
      {children}
      <ScrollRestoration />
      <Scripts />
    </body>
  </html>
)

const App = () => <Outlet />
export default App

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
  const heading =
    isRouteErrorResponse(error) && error.status === 404
      ? `Page not found`
      : `Something went wrong`
  return (
    <main className='mx-auto max-w-prose p-4'>
      <title>{heading}</title>
      <h1 className='text-3xl font-bold'>{heading}</h1>
      <Link to='/' className='underline'>
        Go to the home page
      </Link>
      {import.meta.env.DEV && error instanceof Error ? (
        <pre className='overflow-x-auto'>
          <code>{error.stack}</code>
        </pre>
      ) : null}
    </main>
  )
}
