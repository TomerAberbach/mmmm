import { Form, Link } from 'react-router'
import { Button } from './button.tsx'
import { LetterColors } from './letter-colors.tsx'

export const SiteHeader = ({
  educator,
}: {
  // Null when signed out. Undefined when it couldn't be read, so the header
  // shows neither
  educator?: { name: string } | null
}) => (
  <header className='border-b-2 border-ink print:hidden'>
    <div className='h-2 bg-linear-to-r from-accent-strong via-muted to-accent-soft' />
    <div className='mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-6'>
      <Link
        to='/'
        className='font-display text-3xl no-underline hover:no-underline'
      >
        <LetterColors text='MMMM' />
      </Link>
      {educator ? (
        <Form
          method='post'
          action='/sign-out'
          className='flex items-center gap-4'
        >
          <Link
            to='/settings'
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
          to='/sign-in'
          className='font-semibold no-underline hover:underline'
        >
          Sign in
        </Link>
      ) : null}
    </div>
  </header>
)
