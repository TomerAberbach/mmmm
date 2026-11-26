import { href, NavLink } from 'react-router'
import { formatPercentile, formatRank } from '~/leaderboard-row.ts'
import type { PlayerRank } from '~/leaderboard-row.ts'
import type { ScopeRank } from '~/leaderboard-scopes.server.ts'

/** A player's rank on each of their leaderboards, each opening it */
export const PlayerRanks = ({
  contestId,
  ranks,
}: {
  contestId: string
  ranks: ScopeRank[]
}) => (
  <nav aria-label='Your ranks' className='max-w-3xl'>
    <ul className='flex border-4 border-ink max-sm:flex-col'>
      {ranks.map(({ kind, name, rank }) => (
        <li
          key={kind}
          className='min-w-0 flex-1 border-ink not-first:border-s-2 max-sm:not-first:border-s-0 max-sm:not-first:border-t-2'
        >
          <NavLink
            to={href(`/player/:contestId/leaderboards/:kind`, {
              contestId,
              kind,
            })}
            className='flex h-full flex-col justify-between gap-1 px-4 py-3 text-ink no-underline hover:underline aria-[current=page]:bg-accent-strong aria-[current=page]:text-white max-sm:flex-row max-sm:items-center max-sm:gap-4 print:text-black!'
          >
            <span className='min-w-0 font-condensed font-bold tracking-wider wrap-anywhere uppercase'>
              {name}
            </span>
            <span className='max-sm:text-end'>
              {rank ? <Rank {...rank} /> : `Not ranked`}
            </span>
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
)

const Rank = (playerRank: PlayerRank) => {
  const { rank, total } = playerRank
  const percentile = formatPercentile(playerRank)
  return (
    <>
      <span className='block font-display text-3xl'>{formatRank(rank)}</span>
      {` `}
      <span className='block'>
        {`of ${total.toLocaleString(`en-US`)}`}
        {percentile === null ? `` : ` · ${percentile}`}
      </span>
    </>
  )
}
