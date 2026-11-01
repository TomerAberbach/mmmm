import { data } from 'react-router'
import type { Route } from './+types/play.ts'
import { PageTitle } from '~/components/page-title.tsx'
import { readContestByLink } from '~/contests.server.ts'

// A link that matches no contest gets the not-found page
export const loader = async ({ params }: Route.LoaderArgs) => {
  const contest = await readContestByLink(params.linkSecret)
  if (!contest) {
    throw data(null, { status: 404 })
  }
  return contest
}

const PlayPage = ({ loaderData }: Route.ComponentProps) => (
  <section className='flex max-w-xl flex-col gap-3 border-2 border-ink p-7 shadow-offset shadow-accent-soft'>
    {/* Search engines skip the page, since its URL holds the contest link's
        secret */}
    <meta name='robots' content='noindex' />
    <p className='self-start bg-ink px-2 py-0.5 font-condensed font-bold tracking-widest text-white uppercase'>
      {`March Mammal Madness ${loaderData.yearId}`}
    </p>
    <PageTitle>{loaderData.name}</PageTitle>
    <p className='text-lg text-muted'>{`${loaderData.educatorName}’s contest`}</p>
    <p>
      Brackets open here soon. You’ll enter your name and fill out your bracket.
    </p>
  </section>
)
export default PlayPage
