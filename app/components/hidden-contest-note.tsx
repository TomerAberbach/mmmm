import { SupportLink } from './support-link.tsx'

/** For the educator who runs a hidden contest, and its colleagues */
export const HiddenContestNote = () => (
  <p className='max-w-prose border-2 border-accent p-4 print:hidden'>
    <strong>This contest is hidden,</strong> so its brackets aren’t on the
    organization or global leaderboards. Its own leaderboard still works. Email
    {` `}
    <SupportLink /> if you think that’s a mistake.
  </p>
)
