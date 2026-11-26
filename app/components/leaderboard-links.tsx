import { href, Link } from 'react-router'

/** An educator's links to a year's organization and global leaderboards */
export const LeaderboardLinks = ({
  year,
  hasOrganization,
}: {
  year: number
  hasOrganization: boolean
}) => {
  const params = { year: String(year) }
  return (
    <ul className='flex flex-wrap gap-x-6 gap-y-2 print:hidden'>
      {hasOrganization ? (
        <li>
          <Link to={href(`/contests/years/:year/organization`, params)}>
            Organization leaderboard
          </Link>
        </li>
      ) : null}
      <li>
        <Link to={href(`/contests/years/:year/global`, params)}>
          Global leaderboard
        </Link>
      </li>
    </ul>
  )
}
