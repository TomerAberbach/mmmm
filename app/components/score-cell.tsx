import { pluralize } from '~/format-count.ts'

/** A player's score, beside the name on a phone */
export const ScoreCell = ({ score }: { score: number | null }) => (
  <td className='px-2 py-2 text-end tabular-nums max-sm:absolute max-sm:end-0 max-sm:top-3 max-sm:p-0'>
    {score === null ? (
      <span className='text-muted'>None</span>
    ) : (
      <>
        <span className='font-extrabold'>{score}</span>
        <span className='sm:sr-only'>{` ${pluralize(score, `point`)}`}</span>
      </>
    )}
  </td>
)
