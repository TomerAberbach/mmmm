import { href, Link } from 'react-router'
import { formatCount } from '~/format-count.ts'
import type { PastYearSummary } from '~/past-years.server.ts'

/** Past years, each with its champion and the educator's contests */
export const PastYears = ({ years }: { years: PastYearSummary[] }) =>
  years.length === 0 ? (
    <p className='text-muted'>No past years yet.</p>
  ) : (
    <div className='flex max-w-3xl flex-col gap-8'>
      {years.map(summary => (
        <PastYearSection key={summary.year} summary={summary} />
      ))}
    </div>
  )

const PastYearSection = ({
  summary: { year, champion, contests },
}: {
  summary: PastYearSummary
}) => {
  const headingId = `year-${year}`
  return (
    <section
      aria-labelledby={headingId}
      className='flex flex-col gap-3 border-t-2 border-ink pt-4'
    >
      <h2 id={headingId} className='font-display text-3xl'>
        {year}
      </h2>
      <p className='flex flex-wrap gap-x-4 gap-y-1'>
        {champion === null ? null : (
          <span>
            Champion: <strong>{champion}</strong>
          </span>
        )}
        <Link to={href(`/contests/years/:year`, { year: String(year) })}>
          Bracket and leaderboards
        </Link>
      </p>
      {contests.length > 0 ? (
        <ul className='border-t border-muted-light'>
          {contests.map(({ id, name, sharedBy, submissionCount }) => (
            <li
              key={id}
              className='flex min-h-11 flex-wrap items-center justify-between gap-x-4 border-b border-muted-light py-1'
            >
              <Link
                to={href(`/contests/:contestId`, { contestId: id })}
                className='min-w-0 font-semibold wrap-anywhere'
              >
                {name}
              </Link>
              <span className='text-muted'>
                {[
                  sharedBy === null ? null : `Shared by ${sharedBy}`,
                  formatCount(submissionCount, `submission`),
                ]
                  .filter(Boolean)
                  .join(` · `)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
