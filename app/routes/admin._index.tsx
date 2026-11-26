import { href, Link } from 'react-router'
import type { Route } from './+types/admin._index.ts'
import {
  hidePastDate,
  readAdminYears,
  readBracketSummary,
} from '~/brackets.server.ts'
import type { BracketSummary } from '~/brackets.server.ts'
import { ButtonLink } from '~/components/button.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { PhaseTag } from '~/components/phase-section.tsx'
import { SECTION_HEADING_CLASS_NAME } from '~/components/settings-section.tsx'
import { formatDate } from '~/dates.ts'
import { countReports } from '~/reports.server.ts'

export const loader = async () => {
  const [{ current, setupYear }, reportCount] = await Promise.all([
    readAdminYears(),
    countReports({ kind: `admin` }),
  ])
  const setupSummary =
    setupYear === null ? null : await readBracketSummary(setupYear)
  return {
    reportCount,
    current: current && {
      ...current,
      expectedLockDate: readShownLockDate(current.summary),
    },
    setup: setupYear !== null && {
      year: setupYear,
      summary: setupSummary,
      expectedLockDate: readShownLockDate(setupSummary),
    },
  }
}

const readShownLockDate = (summary: BracketSummary | null): Date | null =>
  summary && `expectedLockDate` in summary
    ? hidePastDate(summary.expectedLockDate)
    : null

const Admin = ({
  loaderData: { reportCount, current, setup },
}: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <PageTitle>Admin</PageTitle>
    {current ? (
      <YearCard {...current}>
        <ButtonLink
          href={href(`/admin/results`)}
          variant={
            current.summary.phase === `COMPLETE` ? `secondary` : `primary`
          }
        >
          {current.summary.phase === `COMPLETE`
            ? `Correct ${current.year} results`
            : `Manage the ${current.year} bracket`}
        </ButtonLink>
      </YearCard>
    ) : null}
    {setup ? (
      <YearCard {...setup}>
        <ButtonLink href={href(`/admin/bracket`)}>
          {setup.summary
            ? `Manage the ${setup.year} bracket`
            : `Set up the ${setup.year} bracket`}
        </ButtonLink>
      </YearCard>
    ) : null}
    <Link to={href(`/contests/past`)} className='self-start'>
      Past years
    </Link>
    <Link to={href(`/admin/reports`)} className='self-start'>
      {`Reports (${reportCount})`}
    </Link>
    <Link to={href(`/admin/educators`)} className='self-start'>
      Educators
    </Link>
    <Link to={href(`/admin/contests`)} className='self-start'>
      Contests
    </Link>
    <Link to={href(`/admin/organizations`)} className='self-start'>
      Organizations
    </Link>
  </div>
)
export default Admin

const YearCard = ({
  year,
  summary,
  expectedLockDate,
  children,
}: {
  year: number
  /** Null before the year's bracket is set up */
  summary: BracketSummary | null
  /** Null without one to show */
  expectedLockDate: Date | null
  children: React.ReactNode
}) => (
  <section className='flex max-w-xl flex-col gap-3 border-2 border-ink p-5'>
    <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
      <h2 className={SECTION_HEADING_CLASS_NAME}>{year} bracket</h2>
      <PhaseTag phase={summary?.phase ?? `SETUP`} />
      {summary ? null : <span className='text-muted'>Not set up yet</span>}
    </div>
    {summary ? null : (
      <p className='text-muted'>
        ASU publishes its bracket in late February. Enter it here, check it,
        then publish it.
      </p>
    )}
    {summary?.phase === `COMPLETE` ? (
      <p className='font-semibold'>Champion: {summary.champion}</p>
    ) : null}
    {expectedLockDate ? (
      <p className='text-muted'>
        Expected to lock on {formatDate(expectedLockDate)}
      </p>
    ) : null}
    <div>{children}</div>
  </section>
)
