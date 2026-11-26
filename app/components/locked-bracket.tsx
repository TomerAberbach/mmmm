import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Bracket } from './bracket.tsx'
import { MarkedBracket } from './marked-bracket.tsx'
import { Notice } from './notice.tsx'
import {
  DeleteButton,
  ForgetButton,
  PersonalLinkButton,
  PicksChanged,
} from './player-controls.tsx'
import type { Submitted } from './player-controls.tsx'
import { buildPicksView } from '~/bracket-view.ts'
import type { SubmissionStatus } from '~/generated/prisma/enums.ts'
import { arePicksEqual } from '~/picks.ts'
import type { Picks } from '~/picks.ts'
import type { Results } from '~/results.ts'
import { toSeededBracket } from '~/seeded-bracket.ts'
import type { StoredBracket } from '~/seeded-bracket.ts'

/**
 * The player's bracket once its year isn't open, read-only. A submission is
 * marked against the results
 */
export const LockedBracket = ({
  year,
  isPast,
  bracket,
  draft,
  submitted,
  results,
  ranks,
  forgetPath,
  deletePath,
  playerId,
}: {
  year: number
  /** Whether a newer year is current, so no educator approves it anymore */
  isPast: boolean
  bracket: StoredBracket
  draft: Picks
  submitted: Submitted | null
  results: Results
  /** Null unless the submission is approved */
  ranks: ReactNode
  forgetPath: string
  deletePath: string
  playerId: string
}) => (
  <>
    {submitted ? (
      <SubmittedBracket
        year={year}
        isPast={isPast}
        bracket={bracket}
        draft={draft}
        submitted={submitted}
        results={results}
        ranks={ranks}
        forgetPath={forgetPath}
      />
    ) : (
      <UnsubmittedBracket year={year} bracket={bracket} draft={draft} />
    )}
    <div className='print:hidden'>
      <DeleteButton
        deletePath={deletePath}
        playerId={playerId}
        isSending={false}
        isOpen={false}
      />
    </div>
  </>
)

const SubmittedBracket = ({
  year,
  isPast,
  bracket,
  draft,
  submitted: { submission, personalLink },
  results,
  ranks,
  forgetPath,
}: {
  year: number
  isPast: boolean
  bracket: StoredBracket
  draft: Picks
  submitted: Submitted
  results: Results
  /** Null unless the submission is approved */
  ranks: ReactNode
  forgetPath: string
}) => (
  <>
    <div className='max-w-prose'>
      <Notice kind={submission.status === `REJECTED` ? `alert` : `status`}>
        {`Submissions are closed. ${
          arePicksEqual(draft, submission.picks)
            ? ``
            : `The changes you made after submitting weren’t submitted. `
        }${isPast && submission.status === `PENDING` ? NEVER_APPROVED : STATUS_NOTES[submission.status]}`}
      </Notice>
    </div>
    {ranks}
    <MarkedBracket
      year={year}
      bracket={bracket}
      picks={submission.picks}
      results={results}
    >
      <PicksChanged at={submission.picksChangedAt} />
      <div className='flex flex-wrap gap-3 print:hidden'>
        <PersonalLinkButton personalLink={personalLink} isOpen={false} />
        <ForgetButton
          forgetPath={forgetPath}
          variant='quiet'
          isSending={false}
        />
      </div>
    </MarkedBracket>
  </>
)

/** A draft never submitted has no score */
const UnsubmittedBracket = ({
  year,
  bracket,
  draft,
}: {
  year: number
  bracket: StoredBracket
  draft: Picks
}) => {
  const view = useMemo(
    () => buildPicksView(year, toSeededBracket(bracket), draft),
    [year, bracket, draft],
  )
  return (
    <>
      <div className='max-w-prose'>
        <Notice kind='alert'>
          Submissions closed before this bracket was submitted, so it doesn’t
          count
        </Notice>
      </div>
      <div className='print:page-landscape'>
        <Bracket view={view} />
      </div>
    </>
  )
}

const STATUS_NOTES: Record<SubmissionStatus, string> = {
  PENDING: `Your bracket is in, and your educator will approve it before it counts.`,
  APPROVED: `Your bracket is in, and your educator approved it.`,
  REJECTED: `Your educator didn’t approve your bracket. You can ask them about it.`,
}

const NEVER_APPROVED = `Your educator didn’t approve your bracket in time, so it doesn’t count.`
