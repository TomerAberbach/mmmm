import { use, useState } from 'react'
import type { SyntheticEvent } from 'react'
import {
  DialogTrigger,
  OverlayTriggerStateContext,
} from 'react-aria-components'
import { Button } from './button.tsx'
import { BUTTONS_CLASS_NAME, ModalFrame } from './modal-frame.tsx'
import { SelectField } from './select-field.tsx'
import { TextField } from './text-field.tsx'
import { describeTakenName } from '~/bracket-input.ts'
import { readBattleName } from '~/bracket-view.ts'
import { toBattleKey } from '~/bracket.ts'
import type { BattleRef } from '~/bracket.ts'
import { freeTextSchema, MERGE_NAME } from '~/free-text.ts'
import { isNameFree, readMergeMembers } from '~/results.ts'
import type { Results } from '~/results.ts'
import type { SeededBracket } from '~/seeded-bracket.ts'

type Mergeable = { battle: BattleRef; sideNames: string[] }

/** The battles among these that have two sides to merge */
export const listMergeable = (
  bracket: SeededBracket,
  results: Results,
  battles: BattleRef[],
): Mergeable[] =>
  battles.flatMap(battle => {
    const memberIds = readMergeMembers(bracket, results, battle)
    return memberIds
      ? {
          battle,
          sideNames: memberIds.map(id => bracket.combatantById.get(id)!.name),
        }
      : []
  })

/**
 * A button, and the dialog it opens to record the merge of a battle's sides
 */
export const MergeDialog = ({
  bracket,
  mergeable,
  isPending,
  onMerge,
}: {
  bracket: SeededBracket
  mergeable: [Mergeable, ...Mergeable[]]
  /** Turns the button off without moving focus from it */
  isPending: boolean
  onMerge: (battle: BattleRef, name: string) => void
}) => (
  <DialogTrigger>
    <Button variant='quiet' isPending={isPending}>
      Record a merge
    </Button>
    <ModalFrame title='Record a merge'>
      <MergeForm bracket={bracket} mergeable={mergeable} onMerge={onMerge} />
    </ModalFrame>
  </DialogTrigger>
)

const suggestName = ({ sideNames }: Mergeable): string => sideNames.join(` & `)

const NAME_SCHEMA = freeTextSchema(MERGE_NAME)

const MergeForm = ({
  bracket,
  mergeable,
  onMerge,
}: Omit<Parameters<typeof MergeDialog>[0], `isPending`>) => {
  const [selected, setSelected] = useState(mergeable[0])
  const [name, setName] = useState(() => suggestName(mergeable[0]))
  const [error, setError] = useState<string | null>(null)
  const select = (key: string) => {
    const next = mergeable.find(({ battle }) => toBattleKey(battle) === key)!
    setSelected(next)
    setName(suggestName(next))
    setError(null)
  }
  const dialog = use(OverlayTriggerStateContext)
  const close = () => dialog?.close()
  const merge = (event: SyntheticEvent) => {
    event.preventDefault()
    const parsed = NAME_SCHEMA.safeParse(name)
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message)
    } else if (isNameFree(bracket, parsed.data)) {
      close()
      onMerge(selected.battle, parsed.data)
    } else {
      setError(describeTakenName(parsed.data))
    }
  }
  return (
    <form onSubmit={merge} className='flex flex-col gap-4'>
      <p>
        Both sides advance together. A pick of either one scores wherever they
        go.
      </p>
      <SelectField
        label='Battle'
        name='battle'
        options={mergeable.map(({ battle, sideNames }) => ({
          id: toBattleKey(battle),
          label: `${readBattleName(battle)}: ${sideNames.join(` vs. `)}`,
        }))}
        value={toBattleKey(selected.battle)}
        onChange={select}
      />
      <TextField
        label='Combined name'
        value={name}
        onChange={setName}
        {...(error !== null && { error })}
        autoComplete='off'
      />
      <div className={BUTTONS_CLASS_NAME}>
        <Button variant='secondary' onPress={close}>
          Cancel
        </Button>
        <Button type='submit'>Record merge</Button>
      </div>
    </form>
  )
}
