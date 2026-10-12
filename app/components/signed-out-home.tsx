import { Link } from 'react-router'
import { ButtonLink } from './button.tsx'
import { PageTitle } from './page-title.tsx'
import { PlayerNote } from './player-note.tsx'

export const SignedOutHome = ({ upcomingYear }: { upcomingYear: number }) => (
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
    <p className='font-condensed text-xl font-bold tracking-wide text-muted'>
      MMMM adds the {upcomingYear} bracket once ASU publishes it, usually in
      late February.
    </p>
    <div className='flex flex-wrap items-center gap-x-6 gap-y-3'>
      <ButtonLink href='/sign-up'>Sign up</ButtonLink>
      <p>
        Already have an account? <Link to='/sign-in'>Sign in</Link>
      </p>
    </div>
    <PlayerNote />
  </div>
)
