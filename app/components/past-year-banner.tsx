import { href, Link, Outlet } from 'react-router'
import type { PastYear } from '~/past-years.server.ts'

/** Says the page is of a past year, if it is, and links to the current one */
export const PastYearBanner = ({
  pastYear,
  currentPath,
}: {
  pastYear: PastYear | null
  /** The current year's page */
  currentPath: string
}) =>
  pastYear && (
    <aside
      aria-label='Past year'
      className='flex flex-wrap items-center justify-between gap-x-6 gap-y-1 bg-ink px-4 py-2.5 text-white print:border-2 print:border-ink print:bg-white print:text-black'
    >
      <p>
        <strong>{`${pastYear.year} is over.`}</strong> You can look, but not
        change anything.
      </p>
      <Link
        to={currentPath}
        className='font-semibold text-white underline print:hidden'
      >
        {`Go to ${pastYear.currentYear}`}
      </Link>
    </aside>
  )

/** An educator's pages of one year */
export const YearLayout = ({ pastYear }: { pastYear: PastYear | null }) => (
  <div className='flex flex-col gap-8'>
    <PastYearBanner pastYear={pastYear} currentPath={href(`/contests`)} />
    <Outlet />
  </div>
)
