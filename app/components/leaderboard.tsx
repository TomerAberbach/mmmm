import { Link } from 'react-router'
import type { LeaderboardRow } from '~/leaderboard-row.ts'

/** Approved submissions by rank, each opening its marked bracket */
export const Leaderboard = ({
  rows,
  toBracketPath,
}: {
  rows: LeaderboardRow[]
  toBracketPath: (playerId: string) => string
}) =>
  rows.length === 0 ? (
    <p className='text-muted'>No approved brackets yet.</p>
  ) : (
    <table className='w-full max-w-3xl border-collapse'>
      <thead>
        <tr className='border-b-2 border-ink font-condensed text-sm font-bold tracking-wider text-muted uppercase'>
          <th scope='col' className='w-16 px-2 py-1.5 text-end'>
            Rank
          </th>
          <th scope='col' className='px-3 py-1.5 text-start'>
            Player
          </th>
          <th scope='col' className='w-20 px-2 py-1.5 text-end'>
            Score
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ playerId, label, score, rank, isOwn }) => (
          <tr
            key={playerId}
            className={`border-b border-muted-light ${isOwn ? `bg-accent-soft/40` : ``}`}
          >
            <td className='px-2 py-2 text-end font-display text-xl tabular-nums'>
              {rank}
            </td>
            <td
              className={`px-3 py-2 wrap-anywhere ${isOwn ? `font-extrabold` : ``}`}
            >
              <Link
                to={toBracketPath(playerId)}
                className='print:text-black print:no-underline'
              >
                {label}
              </Link>
              {isOwn ? (
                <>
                  {` `}
                  <span className='ms-1 font-condensed text-sm font-bold tracking-wider text-accent-strong uppercase'>
                    You
                  </span>
                </>
              ) : null}
            </td>
            <td className='px-2 py-2 text-end text-lg font-semibold tabular-nums'>
              {score}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
