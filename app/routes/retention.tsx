import { LegalPage } from '~/components/legal-page.tsx'
import { PLAYER_DELETION_DAYS } from '~/trash.ts'

const SCHEDULE: { data: string; why: string; until: string }[] = [
  {
    data: `An educator’s name, email address, and hashed password`,
    why: `Sign-in, organization, and support`,
    until: `The account is deleted`,
  },
  {
    data: `Second factors and shared contests`,
    why: `Sign-in and working with colleagues`,
    until: `They’re removed, or the account is deleted`,
  },
  {
    data: `Organizations, by email domain`,
    why: `Leaderboards`,
    until: `The organization asks for its data to be deleted`,
  },
  {
    data: `A player’s display name`,
    why: `Leaderboards`,
    until: `Two years after the tournament`,
  },
  {
    data: `Picks, scores, and ranks`,
    why: `Results and past years`,
    until: `Kept, without names after two years`,
  },
  {
    data: `Drafts never submitted`,
    why: `Coming back to a bracket`,
    until: `Next year’s bracket is published`,
  },
  {
    data: `Trash`,
    why: `Undoing a deletion`,
    until: `Next year’s bracket is published, or the educator empties it. A bracket its player deleted: ${PLAYER_DELETION_DAYS} days`,
  },
  {
    data: `Contest and personal links`,
    why: `Access`,
    until: `The contest or bracket is erased, or the link is replaced`,
  },
  {
    data: `Reports of names`,
    why: `Moderation`,
    until: `The bracket or contest is erased. Reports of a player’s name also go when the name is removed`,
  },
  {
    data: `Contest names`,
    why: `Dashboards and leaderboards`,
    until: `The contest is erased`,
  },
  {
    data: `Sessions`,
    why: `Staying signed in`,
    until: `30 days after the last renewal`,
  },
  {
    data: `Emailed links, such as one that changes an address`,
    why: `Confirming who asked`,
    until: `They’re used, or up to 4 days`,
  },
  { data: `IP addresses`, why: `Rate limits`, until: `Never stored` },
  { data: `Backups`, why: `Disaster recovery`, until: `30 days` },
]

const Retention = () => (
  <LegalPage title='Retention schedule'>
    <p>What MMMM keeps, why, and for how long.</p>
    <table className='w-full border-collapse'>
      <thead>
        <tr className='border-b-2 border-ink font-condensed text-sm font-bold tracking-wider text-muted uppercase'>
          <th scope='col' className='py-1.5 pe-3 text-start'>
            Data
          </th>
          <th scope='col' className='py-1.5 pe-3 text-start'>
            Why
          </th>
          <th scope='col' className='py-1.5 text-start'>
            Kept until
          </th>
        </tr>
      </thead>
      <tbody>
        {SCHEDULE.map(({ data, why, until }) => (
          <tr key={data} className='border-b border-muted-light align-top'>
            <th scope='row' className='py-2 pe-3 text-start font-semibold'>
              {data}
            </th>
            <td className='py-2 pe-3'>{why}</td>
            <td className='py-2'>{until}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </LegalPage>
)
export default Retention
