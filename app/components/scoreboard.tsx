import { useId, useState } from 'react'
import { Button } from 'react-aria-components'
import { INNER_FOCUS_CLASSES } from './focus-classes.ts'
import { BATTLE_COUNTS, ROUND_NAMES } from '~/bracket.ts'
import type { Round } from '~/bracket.ts'
import { pluralize } from '~/format-count.ts'
import type { RoundScore, Scorecard } from '~/scorecard.ts'
import { PERFECT_SCORE, ROUND_POINTS } from '~/scoring.ts'

/** The score of a marked bracket, and how each round added to it */
export const Scoreboard = ({
  scorecard: { score, possible, isFinal, rounds },
}: {
  scorecard: Scorecard
}) => {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className='me-2 max-w-5xl border-4 border-ink bg-white shadow-offset print:me-0 print:shadow-none'
    >
      <div className='flex flex-col sm:flex-row'>
        <div className='flex flex-col items-center gap-1 bg-accent-strong px-7 py-4 text-center text-white print:bg-transparent print:text-black'>
          <h2 id={headingId} className={LABEL_CLASS_NAME}>
            {isFinal ? `Final score` : `Score so far`}
          </h2>
          <p className='font-display text-8xl leading-none'>{score}</p>
          <p className={LABEL_CLASS_NAME}>of {PERFECT_SCORE} points</p>
        </div>
        <div className='flex min-w-0 flex-1 flex-col justify-center gap-2 px-6 py-5'>
          <ScoreBar score={score} possible={possible} />
          <p className='text-lg'>
            <PointCount count={score} /> earned
            {possible > 0 ? (
              <>
                {` · `}
                <PointCount count={possible} /> still possible
              </>
            ) : null}
            {` · `}
            <PointCount count={PERFECT_SCORE - score - possible} /> missed
          </p>
        </div>
      </div>
      <RoundScores rounds={rounds} />
    </section>
  )
}

const LABEL_CLASS_NAME = `font-condensed font-bold tracking-wider uppercase`

const PointCount = ({ count }: { count: number }) => (
  <span className='font-condensed text-xl font-extrabold tabular-nums'>
    {count}
  </span>
)

/** Every point of a perfect bracket. The counts beside it say the same */
const ScoreBar = ({ score, possible }: { score: number; possible: number }) => (
  <div
    aria-hidden
    className='flex h-9 border-3 border-ink bg-white print:hidden'
  >
    <div className='bg-accent-strong' style={{ width: readShare(score) }} />
    <div className='bg-stripes' style={{ width: readShare(possible) }} />
  </div>
)

const readShare = (points: number): string =>
  `${(100 * points) / PERFECT_SCORE}%`

/** A phone keeps them behind a button, so the bracket shows sooner */
const RoundScores = ({ rounds }: { rounds: RoundScore[] }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const listId = useId()
  return (
    <div className='border-t-4 border-ink'>
      <Button
        aria-expanded={isExpanded}
        aria-controls={listId}
        onPress={() => setIsExpanded(!isExpanded)}
        className={`flex min-h-11 w-full cursor-pointer items-center gap-2 px-4 text-accent-strong lg:hidden print:hidden ${INNER_FOCUS_CLASSES} ${LABEL_CLASS_NAME}`}
      >
        <span aria-hidden>{isExpanded ? `▾` : `▸`}</span>
        Points by round
      </Button>
      <ul
        id={listId}
        className={`flex-col gap-0.5 border-ink bg-muted-light max-lg:border-t-2 lg:grid lg:grid-cols-7 print:grid print:grid-cols-7 ${isExpanded ? `flex` : `hidden`}`}
      >
        {rounds.map(roundScore => (
          <RoundTile key={roundScore.round} roundScore={roundScore} />
        ))}
      </ul>
    </div>
  )
}

/** The diagram's round markers, and the colors of the rounds without one */
const ROUND_CLASSES: Record<Round, string> = {
  WILD_CARD: `bg-accent-strong`,
  ROUND_1: `bg-round-1`,
  ROUND_2: `bg-round-2`,
  SWEET_16: `bg-sweet-16`,
  ELITE_TRAIT: `bg-elite-trait`,
  FINAL_ROAR: `bg-accent`,
  CHAMPIONSHIP: `bg-ink`,
}

const RoundTile = ({ roundScore }: { roundScore: RoundScore }) => {
  const { round, decided, earned } = roundScore
  return (
    <li className='flex bg-white lg:flex-col print:flex-col'>
      <span
        aria-hidden
        className={`w-2 shrink-0 lg:h-2 lg:w-full print:h-2 print:w-full ${ROUND_CLASSES[round]}`}
      />
      <div className='flex flex-1 items-center gap-3 px-3 py-2 lg:flex-col lg:gap-1 lg:px-1 lg:pb-3 lg:text-center print:flex-col print:gap-1 print:px-1 print:text-center'>
        <p className='flex-1 font-condensed font-bold tracking-wide uppercase lg:flex-none print:flex-none'>
          {ROUND_NAMES[round]}
        </p>
        <p className='min-w-12 text-end font-display text-2xl max-lg:order-last lg:text-center lg:text-4xl print:order-none print:text-center'>
          {decided > 0 ? (
            <>
              {earned}
              <span className='sr-only'>
                {` ${pluralize(earned, `point`)}`}
              </span>
            </>
          ) : (
            <span aria-hidden className='text-muted'>
              –
            </span>
          )}
        </p>
        <p className='text-sm text-muted'>{describeRound(roundScore)}</p>
      </div>
    </li>
  )
}

const describeRound = ({ round, right, decided, left }: RoundScore): string => {
  if (decided > 0) {
    return `${right} of ${decided} right${left > 0 ? `, ${left} left` : ``}`
  }
  return left > 0
    ? `${ROUND_POINTS[round]} ${BATTLE_COUNTS[round] > 1 ? `each` : `to win`}`
    : `Not decided`
}
