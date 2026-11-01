import { Link } from 'react-router'
import { CopyButton } from './copy-button.tsx'
import { CreateContestDialog } from './create-contest-dialog.tsx'
import { PageHeader } from './page-header.tsx'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'
import type { ContestSummary } from '~/contests.server.ts'

// Contests open once a bracket is published, so there's no current year yet
// when `current` is null
export type EducatorDashboardView =
  | { current: null; upcomingYear: number }
  | { current: { year: number; contests: ContestSummary[] } }

export const EducatorDashboard = ({
  view,
}: {
  view: EducatorDashboardView
}) => {
  const { current } = view
  const hasContests = Boolean(current?.contests.length)
  return (
    <div className='flex max-w-3xl flex-col gap-8'>
      <PageHeader
        label={current ? String(current.year) : undefined}
        title='Your contests'
        action={hasContests ? <CreateContestDialog /> : null}
      />
      {current ? (
        hasContests ? (
          <ContestList contests={current.contests} />
        ) : (
          <FirstContest />
        )
      ) : (
        <BracketNotReady upcomingYear={view.upcomingYear} />
      )}
    </div>
  )
}

// A notice instead of a disabled Create button, which wouldn't say why
const BracketNotReady = ({ upcomingYear }: { upcomingYear: number }) => (
  <section className='flex flex-col gap-2 border-2 border-ink p-5 shadow-offset shadow-sweet-16'>
    <h2 className={SECTION_HEADING_CLASS_NAME}>
      {`The ${upcomingYear} bracket isn’t ready yet`}
    </h2>
    <p className='max-w-prose'>
      You can create {upcomingYear} contests once the bracket is published. ASU
      releases it in early March.
    </p>
  </section>
)

const FirstContest = () => (
  <section className='flex flex-col items-start gap-4 border-2 border-dashed border-muted-light p-8'>
    <h2 className={SECTION_HEADING_CLASS_NAME}>Start your first contest</h2>
    <p className='max-w-prose'>
      A contest is one group of players, such as a class period. You get a link
      to share with them.
    </p>
    <CreateContestDialog />
  </section>
)

const ContestList = ({ contests }: { contests: ContestSummary[] }) => (
  <ul className='flex flex-col border-t-2 border-ink'>
    {contests.map(({ id, name, link }) => (
      <li
        key={id}
        className='flex min-h-14 flex-wrap items-center justify-between gap-x-4 border-b border-muted-light py-1'
      >
        <Link
          to={`/contests/${id}`}
          className='min-w-0 text-lg font-semibold break-words'
        >
          {name}
        </Link>
        <CopyButton
          text={link}
          variant='quiet'
          aria-label={`Copy link for ${name}`}
        />
      </li>
    ))}
  </ul>
)
