import { Link } from 'react-router'
import type { PageNumber } from '~/page-number.ts'

/** Moves between the pages of a list */
export const Pages = ({ number, count }: PageNumber) =>
  count > 1 ? (
    <nav
      aria-label='Pages'
      className='flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2'
    >
      {number > 1 ? (
        <Link to={{ search: `?page=${number - 1}` }} className='print:hidden'>
          Previous
        </Link>
      ) : null}
      <span className='text-muted'>{`Page ${number} of ${count}`}</span>
      {number < count ? (
        <Link to={{ search: `?page=${number + 1}` }} className='print:hidden'>
          Next
        </Link>
      ) : null}
    </nav>
  ) : null
