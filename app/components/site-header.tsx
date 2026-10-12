import { Link } from 'react-router'
import { LetterColors } from './letter-colors.tsx'

export const SiteHeader = () => (
  <header className='border-b-2 border-ink print:hidden'>
    <div className='h-2 bg-linear-to-r from-accent-strong via-muted to-accent-soft' />
    <div className='mx-auto flex min-h-16 max-w-6xl items-center px-4 sm:px-6'>
      <Link
        to='/'
        className='font-display text-3xl no-underline hover:no-underline'
      >
        <LetterColors text='MMMM' />
      </Link>
    </div>
  </header>
)
