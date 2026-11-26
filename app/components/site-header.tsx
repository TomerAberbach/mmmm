import { Form, href, Link } from 'react-router'
import { Button } from './button.tsx'
import { LetterColors } from './letter-colors.tsx'

export const SiteHeader = ({
  educator,
}: {
  /**
   * Null when signed out. Undefined when it couldn't be read, so the header
   * shows neither
   */
  educator?: { name: string; reportCount: number; isAdmin: boolean } | null
}) => (
  <header className='border-b-2 border-ink print:hidden'>
    <div className='h-2 bg-linear-to-r from-accent-strong via-muted to-accent-soft' />
    <div className='mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-6'>
      <Link
        to={href(`/`)}
        className='font-display text-3xl no-underline hover:no-underline'
      >
        <LetterColors text='MMMM' />
      </Link>
      {educator ? (
        <Form
          method='post'
          action={href(`/sign-out`)}
          className='flex flex-wrap items-center gap-x-4 gap-y-2'
        >
          {educator.isAdmin ? (
            <Link
              to={href(`/admin`)}
              className='font-semibold text-ink no-underline hover:underline'
            >
              Admin
            </Link>
          ) : null}
          {educator.reportCount > 0 ? (
            <Link to={href(`/contests/reports`)} className='font-semibold'>
              {`Reports (${educator.reportCount})`}
            </Link>
          ) : null}
          <Link
            to={href(`/settings`)}
            className='font-semibold text-ink no-underline hover:underline'
          >
            {educator.name}
          </Link>
          <Button type='submit' variant='secondary'>
            Sign out
          </Button>
        </Form>
      ) : educator === null ? (
        <Link
          to={href(`/sign-in`)}
          className='font-semibold no-underline hover:underline'
        >
          Sign in
        </Link>
      ) : null}
    </div>
  </header>
)
