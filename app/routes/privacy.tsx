import { href, Link, useRouteLoaderData } from 'react-router'
import { LegalPage, LegalSection } from '~/components/legal-page.tsx'
import type { loader as rootLoader } from '~/root.tsx'
import { PLAYER_DELETION_DAYS } from '~/trash.ts'

const Privacy = () => (
  <LegalPage title='Privacy policy'>
    <p>
      MMMM is for educators who run March Mammal Madness contests for their
      players, on behalf of the players’ families. It shows no ads, sells no
      data, uses no analytics, and builds no profiles of players.
    </p>
    <LegalSection title='What MMMM keeps'>
      <ul className='flex list-disc flex-col gap-1 ps-5'>
        <li>An educator’s name, email address, and hashed password.</li>
        <li>
          A player’s display name, such as a first name and last initial, and
          their picks and scores. Players have no account and give no email
          address.
        </li>
        <li>
          An educator’s organization, from their email address’s domain, the
          contests they share, and any second factors they set up.
        </li>
        <li>
          Cookies that sign an educator in and keep them signed in, or remember
          a player’s bracket until 15 minutes after their last visit.
        </li>
      </ul>
      <p>
        MMMM never stores IP addresses or which browser you use. The{` `}
        <Link to={href(`/retention`)}>retention schedule</Link> says how long
        everything is kept.
      </p>
    </LegalSection>
    <LegalSection title='Who sees a player’s name'>
      <ul className='flex list-disc flex-col gap-1 ps-5'>
        <li>
          Their educator, and the colleagues the educator shares the contest
          with.
        </li>
        <li>
          Other players in the same contest, for the top score tiers and once
          submissions close.
        </li>
        <li>MMMM’s admin, for support and reports.</li>
        <li>
          Anyone at a computer that still remembers the player. “Done, forget
          this computer” clears it.
        </li>
        <li>
          The providers that host MMMM and its database and backups, which
          process it only for MMMM.
        </li>
      </ul>
      <p>
        Other leaderboards show “Player” or where the player is from instead.
      </p>
    </LegalSection>
    <LegalSection title='Seeing or deleting a player’s data'>
      <p>
        A player can delete their bracket from their personal link. Unless their
        educator restores it, it’s erased for good after{` `}
        {PLAYER_DELETION_DAYS} days, though backups keep it for up to 30 more. A
        parent can ask the educator, or email <SupportEmail />, to see or delete
        it. Requests are handled within 30 days.
      </p>
      <p>
        An educator can delete their account in account settings. Their contests
        stay, with their players and the organization they count toward, but
        without the educator. An organization can ask for all of its data to be
        deleted.
      </p>
    </LegalSection>
  </LegalPage>
)
export default Privacy

const SupportEmail = () => {
  const supportEmail =
    useRouteLoaderData<typeof rootLoader>(`root`)?.supportEmail
  return supportEmail === undefined ? (
    `support`
  ) : (
    <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
  )
}
