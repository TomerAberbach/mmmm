import { href } from 'react-router'
import type { Route } from './+types/admin._index.ts'
import { readBracketSummary } from '~/brackets.server.ts'
import { ButtonLink } from '~/components/button.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { PhaseTag } from '~/components/phase-section.tsx'
import { SECTION_HEADING_CLASS_NAME } from '~/components/settings-section.tsx'
import { formatDate } from '~/dates.ts'
import { readUpcomingYear } from '~/year.ts'

export const loader = async () => {
  const year = readUpcomingYear(new Date())
  const summary = await readBracketSummary(year)
  return {
    year,
    // Null before the year's bracket is set up
    phase: summary?.phase ?? null,
    expectedLockDate:
      summary?.expectedLockDate && formatDate(summary.expectedLockDate),
  }
}

const Admin = ({
  loaderData: { year, phase, expectedLockDate },
}: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <PageTitle>Admin</PageTitle>
    <section className='flex max-w-xl flex-col gap-3 border-2 border-ink p-5'>
      <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
        <h2 className={SECTION_HEADING_CLASS_NAME}>{year} bracket</h2>
        <PhaseTag phase={phase ?? `SETUP`} />
        {phase === null ? (
          <span className='text-muted'>Not set up yet</span>
        ) : null}
      </div>
      {phase === null ? (
        <p className='text-muted'>
          ASU publishes its bracket in March. Enter it here, check it, then
          publish it.
        </p>
      ) : null}
      {expectedLockDate ? (
        <p className='text-muted'>Expected to lock {expectedLockDate}</p>
      ) : null}
      <div>
        <ButtonLink href={href(`/admin/bracket`)}>
          {phase === null
            ? `Set up the ${year} bracket`
            : `Manage the ${year} bracket`}
        </ButtonLink>
      </div>
    </section>
  </div>
)
export default Admin
