import { NavLink } from 'react-router'

/** Moves between a player's bracket and the leaderboards they see */
export const LeaderboardNav = ({
  links,
}: {
  links: { to: string; label: string }[]
}) => (
  <nav
    aria-label='Leaderboards'
    className='flex flex-wrap gap-x-6 gap-y-2 print:hidden'
  >
    {links.map(({ to, label }) => (
      <NavLink
        key={to}
        to={to}
        className='min-w-0 wrap-anywhere aria-[current=page]:font-extrabold'
      >
        {label}
      </NavLink>
    ))}
  </nav>
)
