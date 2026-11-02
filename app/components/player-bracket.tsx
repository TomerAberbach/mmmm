import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bracket } from './bracket.tsx'
import { Button } from './button.tsx'
import { PickingContext } from './picking.ts'
import type { Picking } from './picking.ts'
import type { BracketInput } from '~/bracket-input.ts'
import {
  buildBracketView,
  readBattleName,
  readStartingRound,
} from '~/bracket-view.ts'
import type { BracketView } from '~/bracket-view.ts'
import { listBattles, toBattleKey } from '~/bracket.ts'
import type { BattleRef, Round } from '~/bracket.ts'
import { formatTime } from '~/dates.ts'
import {
  listContenders,
  pickWinner,
  toPickBracket,
  TOTAL_BATTLES,
} from '~/picks.ts'
import type { Picks } from '~/picks.ts'

// The player's bracket, each battle a control. Every change saves the whole
// set of picks to `savePath`
export const PlayerBracket = ({
  year,
  input,
  initialPicks,
  savePath,
}: {
  year: number
  input: BracketInput
  initialPicks: Picks
  savePath: string
}) => {
  const bracket = useMemo(() => toPickBracket(input), [input])
  const [picks, setPicks] = useState(initialPicks)
  // Every battle a change has cleared. One picked again shows as picked
  const [cleared, setCleared] = useState<ReadonlySet<string>>(() => new Set())
  const [lastCleared, setLastCleared] = useState<BattleRef[]>([])
  const view = useMemo(
    () => buildBracketView(year, input, picks),
    [year, input, picks],
  )
  const { round, setRound, showBattle } = useShownRound(view)
  const { status, save } = useAutosave(savePath)

  const picking = useMemo(
    (): Picking => ({
      pick: (battle, winner) => {
        const next = pickWinner(bracket, picks, battle, winner)
        setPicks(next.picks)
        setCleared(new Set([...cleared, ...next.cleared.map(toBattleKey)]))
        setLastCleared(next.cleared)
        save(next.picks)
      },
      listContenders: battle => listContenders(bracket, battle),
      isCleared: battle => {
        const key = toBattleKey(battle)
        return cleared.has(key) && picks[key] === undefined
      },
    }),
    [bracket, picks, cleared, save],
  )

  const unpicked = listBattles().filter(
    battle => picks[toBattleKey(battle)] === undefined,
  )
  return (
    <PickingContext value={picking}>
      <div className='sticky top-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-b-2 border-ink bg-white py-3 print:hidden'>
        <PickProgress unpicked={unpicked} onShowBattle={showBattle} />
        <SaveStatus status={status} onRetry={() => save(picks)} />
      </div>
      <ClearedNotice cleared={lastCleared} />
      <Bracket view={view} selection={{ round, onSelect: setRound }} />
    </PickingContext>
  )
}

// The round the tabs show, and a way to show and focus any battle, switching
// tabs when it's in another round
const useShownRound = (view: BracketView) => {
  const [round, setRound] = useState<Round>(() => readStartingRound(view))
  const battleToFocus = useRef<BattleRef>(undefined)
  useEffect(() => {
    if (battleToFocus.current) {
      focusBattle(battleToFocus.current)
      battleToFocus.current = undefined
    }
  }, [round])
  const showBattle = (battle: BattleRef): void => {
    if (battle.round === round) {
      focusBattle(battle)
    } else {
      // Focuses it once its round's tab renders
      battleToFocus.current = battle
      setRound(battle.round)
    }
  }
  return { round, setRound, showBattle }
}

const PickProgress = ({
  unpicked,
  onShowBattle,
}: {
  unpicked: BattleRef[]
  onShowBattle: (battle: BattleRef) => void
}) => {
  const nextBattle = unpicked[0]
  return (
    <>
      <span className='font-condensed text-xl font-bold uppercase'>
        {`${TOTAL_BATTLES - unpicked.length} of ${TOTAL_BATTLES} picked`}
      </span>
      {nextBattle ? (
        <Button variant='quiet' onPress={() => onShowBattle(nextBattle)}>
          Next battle to pick
        </Button>
      ) : null}
    </>
  )
}

// The live region stays in place, so its first message is announced
const ClearedNotice = ({ cleared }: { cleared: BattleRef[] }) => (
  <output
    className={
      cleared.length > 0
        ? `max-w-prose border-2 border-ink bg-white p-3`
        : `sr-only`
    }
  >
    {describeCleared(cleared)}
  </output>
)

const describeCleared = (cleared: BattleRef[]): string =>
  cleared.length === 0
    ? ``
    : `Your change cleared ${cleared.length} later ${cleared.length === 1 ? `pick` : `picks`} that depended on it: ${cleared.map(readBattleName).join(`, `)}.`

type SaveState =
  | { kind: `idle` }
  | { kind: `saving` }
  | { kind: `saved`; at: Date }
  | { kind: `failed` }
  // The server refused the picks, so sending them again fails the same way
  | { kind: `refused` }

// Saves one set of picks at a time, so they reach the server in order. A save
// asked for during another waits, and only the newest waiting set is sent
const useAutosave = (
  path: string,
): { status: SaveState; save: (picks: Picks) => void } => {
  const [status, setStatus] = useState<SaveState>({ kind: `idle` })
  const isSaving = useRef(false)
  const waiting = useRef<Picks | null>(null)

  const save = useCallback(
    (picks: Picks): void => {
      const send = (sent: Picks): void => {
        isSaving.current = true
        setStatus({ kind: `saving` })
        void fetch(path, {
          method: `POST`,
          // A player the server no longer remembers gets a redirect, which
          // would otherwise end at a page that answers 200
          redirect: `manual`,
          headers: { 'Content-Type': `application/json` },
          body: JSON.stringify({ picks: sent }),
        })
          .then(response => {
            setStatus(readSaveState(response))
          })
          .catch(() => setStatus({ kind: `failed` }))
          .finally(() => {
            isSaving.current = false
            const next = waiting.current
            waiting.current = null
            if (next) {
              send(next)
            }
          })
      }
      if (isSaving.current) {
        waiting.current = picks
      } else {
        send(picks)
      }
    },
    [path],
  )
  return { status, save }
}

// A redirect means the server no longer remembers the player, and a 4xx that
// the bracket changed since the page loaded. Reloading resolves both
const readSaveState = (response: Response): SaveState => {
  if (response.ok) {
    return { kind: `saved`, at: new Date() }
  }
  return {
    kind:
      response.type === `opaqueredirect` || response.status < 500
        ? `refused`
        : `failed`,
  }
}

const SaveStatus = ({
  status,
  onRetry,
}: {
  status: SaveState
  onRetry: () => void
}) => {
  switch (status.kind) {
    case `idle`:
      return <span className='text-muted'>Picks save as you go</span>
    case `saving`:
      return <span className='text-muted'>Saving…</span>
    case `saved`:
      return (
        <span className='text-muted'>
          {`Saved at ${formatTime(status.at)}`}
        </span>
      )
    case `failed`:
      return (
        <span
          role='alert'
          className='flex items-center gap-2 font-semibold text-danger'
        >
          Couldn’t save. Your picks are still here
          <Button variant='quiet' onPress={onRetry}>
            Try again
          </Button>
        </span>
      )
    case `refused`:
      return (
        <span role='alert' className='font-semibold text-danger'>
          Couldn’t save your latest picks. Reload the page to keep picking
        </span>
      )
  }
}

// Focuses the battle's first control in whichever layout is showing
const focusBattle = (battle: BattleRef): void => {
  const boxes = document.querySelectorAll<HTMLElement>(
    `[data-battle="${CSS.escape(toBattleKey(battle))}"]`,
  )
  const box = [...boxes].find(element => element.checkVisibility())
  box?.scrollIntoView({ block: `center`, inline: `center` })
  box?.querySelector<HTMLElement>(`input, button`)?.focus()
}
