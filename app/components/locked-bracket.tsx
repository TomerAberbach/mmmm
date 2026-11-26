import { useMemo } from 'react'
import { Bracket } from './bracket.tsx'
import { Notice } from './notice.tsx'
import {
  DeleteButton,
  ForgetButton,
  PersonalLinkButton,
  PicksChanged,
} from './player-controls.tsx'
import type { Submitted } from './player-controls.tsx'
import { Scoreboard } from './scoreboard.tsx'
import {
  buildMarkedBracketView,
  buildPicksView,
  isMarked,
} from '~/bracket-view.ts'
import type { SubmissionStatus } from '~/generated/prisma/enums.ts'
import { arePicksEqual } from '~/picks.ts'
import type { Picks } from '~/picks.ts'
import type { Results } from '~/results.ts'
import { readScorecard } from '~/scorecard.ts'
import { toSeededBracket } from '~/seeded-bracket.ts'
import type { StoredBracket } from '~/seeded-bracket.ts'

/**
 * The player's bracket once its year isn't open, read-only. A submission is
 * marked against the results
 */
export const LockedBracket = ({
  year,
  bracket,
  draft,
  submitted,
  results,
  forgetPath,
  deletePath,
  playerId,
}: {
  year: number
  bracket: StoredBracket
  draft: Picks
  submitted: Submitted | null
  results: Results
  forgetPath: string
  deletePath: string
  playerId: string
}) => {
  const picks = submitted ? submitted.submission.picks : draft
  const view = useMemo(() => {
    const seededBracket = toSeededBracket(bracket)
    // A draft never submitted has no score
    return submitted
      ? buildMarkedBracketView(year, seededBracket, picks, results)
      : buildPicksView(year, seededBracket, picks)
  }, [year, bracket, picks, submitted, results])
  return (
    <>
      <div className='max-w-prose'>
        {submitted ? (
          <Notice
            kind={
              submitted.submission.status === `REJECTED` ? `alert` : `status`
            }
          >
            {`Submissions are closed. ${
              arePicksEqual(draft, picks)
                ? ``
                : `The changes you made after submitting weren’t submitted. `
            }${STATUS_NOTES[submitted.submission.status]}`}
          </Notice>
        ) : (
          <Notice kind='alert'>
            Submissions closed before this bracket was submitted, so it doesn’t
            count
          </Notice>
        )}
      </div>
      {submitted ? (
        <>
          {isMarked(view) ? (
            <Scoreboard scorecard={readScorecard(view)} />
          ) : null}
          <PicksChanged at={submitted.submission.picksChangedAt} />
          <div className='flex flex-wrap gap-3 print:hidden'>
            <PersonalLinkButton
              personalLink={submitted.personalLink}
              isOpen={false}
            />
            <ForgetButton
              forgetPath={forgetPath}
              variant='quiet'
              isSending={false}
            />
          </div>
        </>
      ) : null}
      <div className='print:page-landscape'>
        <Bracket view={view} />
      </div>
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
}

const STATUS_NOTES: Record<SubmissionStatus, string> = {
  PENDING: `Your bracket is in, and your educator will approve it before it counts.`,
  APPROVED: `Your bracket is in, and your educator approved it.`,
  REJECTED: `Your educator didn’t approve your bracket. You can ask them about it.`,
}
