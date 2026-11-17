import { href, Link } from 'react-router'
import { Bracket } from './bracket.tsx'
import { ButtonLink } from './button.tsx'
import { LockHeadsUp } from './lock-heads-up.tsx'
import { PageTitle } from './page-title.tsx'
import { PlayerNote } from './player-note.tsx'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'
import type { CurrentBracket } from '~/current-bracket.server.ts'

// Below its intro, the page shows the current bracket, if any is published
export const SignedOutHome = ({
  upcomingYear,
  current,
}: {
  upcomingYear: number
  current: CurrentBracket | null
}) => (
  <div className='flex flex-col gap-10'>
    {/* The page is full width for the diagram, so the rest keeps the usual
        width */}
    <div className='mx-auto w-full max-w-6xl'>
      <Intro
        upcomingYear={upcomingYear}
        isUpcomingCurrent={current?.view.year === upcomingYear}
      />
    </div>
    {current ? (
      <section className='flex flex-col gap-4'>
        <div className='mx-auto flex w-full max-w-6xl flex-col gap-4'>
          <h2 className={SECTION_HEADING_CLASS_NAME}>
            {current.view.year} bracket
          </h2>
          {current.expectedLockDate ? (
            <LockHeadsUp expectedLockDate={current.expectedLockDate} />
          ) : null}
        </div>
        <Bracket view={current.view} />
      </section>
    ) : null}
  </div>
)

const Intro = ({
  upcomingYear,
  isUpcomingCurrent,
}: {
  upcomingYear: number
  isUpcomingCurrent: boolean
}) => (
  <div className='flex max-w-2xl flex-col gap-6'>
    <PageTitle>Play March Mammal Madness with your class</PageTitle>
    <p className='text-lg'>
      MMMM collects your players&apos; brackets for ASU&apos;s{` `}
      <a href='https://libguides.asu.edu/marchmammalmadness'>
        March Mammal Madness
      </a>
      {` `}
      tournament and scores them as each round&apos;s results come in.
    </p>
    {isUpcomingCurrent ? null : (
      <p className='font-condensed text-xl font-bold tracking-wide text-muted'>
        MMMM adds the {upcomingYear} bracket once ASU publishes it, usually in
        late February.
      </p>
    )}
    <div className='flex flex-wrap items-center gap-x-6 gap-y-3'>
      <ButtonLink href={href(`/sign-up`)}>Sign up</ButtonLink>
      <p>
        Already have an account? <Link to={href(`/sign-in`)}>Sign in</Link>
      </p>
    </div>
    <PlayerNote />
  </div>
)
