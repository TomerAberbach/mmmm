import { getFormProps } from '@conform-to/react'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, ReactElement } from 'react'
import { Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components'
import { href, useFetcher, useFetchers, useSubmit } from 'react-router'
import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
import { Checkbox } from './checkbox.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import type { ConfirmResult } from './confirm-dialog.tsx'
import { FetcherError } from './fetcher-error.tsx'
import { FormError } from './form-error.tsx'
import { LocalTime } from './local-time.tsx'
import { NewPersonalLink } from './new-personal-link.tsx'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useInlineEdit } from './use-inline-edit.ts'
import { useValidatedForm } from './use-validated-form.ts'
import type { ContestPlayer } from '~/contest-players.server.ts'
import { formatDateTime } from '~/dates.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { formatCount } from '~/format-count.ts'
import { freeTextSchema } from '~/free-text.ts'
import type { SubmissionStatus } from '~/generated/prisma/browser.ts'
import { joinIds } from '~/id-list.ts'
import { playerNameSchema } from '~/player-forms.ts'
import type { Decision } from '~/player-forms.ts'
import { findPossibleDuplicates } from '~/possible-duplicates.ts'
import { describeStatus } from '~/submission-status.ts'

/** Each section's players, by submission status, or null for drafts */
const SECTIONS: (SubmissionStatus | null)[] = [
  `PENDING`,
  `APPROVED`,
  `REJECTED`,
  null,
]

/** What an educator does to a row */
type RowChange = Decision | `DELETED`

const DECISION_LABELS: Record<Decision, string> = {
  APPROVED: `Approve`,
  REJECTED: `Reject`,
}

/** What a screen reader hears once a change is made */
const CHANGE_DONE: Record<RowChange, string> = {
  APPROVED: `Approved`,
  REJECTED: `Rejected`,
  DELETED: `Deleted`,
}

const DECISIONS: Decision[] = [`APPROVED`, `REJECTED`]

/** A draft can't be approved or rejected */
const listDecisions = ({ status }: ContestPlayer): Decision[] =>
  status ? DECISIONS.filter(decision => decision !== status) : []

/**
 * Lists a contest's players in sections by status. Approving or rejecting
 * moves a row to its new section, so focus moves to the next row in the
 * section it left, and a screen reader hears the change. Selecting rows, in
 * any sections, opens a bar that approves, rejects, or deletes them together
 */
export const ContestPlayers = ({
  contestId,
  players,
}: {
  contestId: string
  players: ContestPlayer[]
}) => {
  const [announcement, setAnnouncement] = useState(``)
  const [newLinkPlayer, setNewLinkPlayer] = useState<ContestPlayer | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const { moves, pendingIds, submit, remove, dismissErrors } =
    useMoves(contestId)
  const selection = useSelection(players)

  const isSelecting = selection.players.length > 0
  const isSelectionPending = selection.players.some(({ id }) =>
    pendingIds.has(id),
  )
  const clearSelection = () => {
    // The bar stays open until its change is done
    if (!isSelectionPending) {
      dismissErrors()
      selection.clear()
    }
  }
  const clearOnEscape = (event: KeyboardEvent) => {
    if (event.key === `Escape` && !event.defaultPrevented && isSelecting) {
      clearSelection()
    }
  }
  const select = (ids: string[], isSelected: boolean) => {
    // An error describes the selection it refused, not a changed one
    dismissErrors()
    selection.change(ids, isSelected)
  }

  const changeGroup = (changedPlayers: ContestPlayer[], change: RowChange) => {
    setAnnouncement(``)
    submit(changedPlayers, change, {
      selectedIds: selection.ids,
      focusTargetId: change === `DELETED` ? LIST_TARGET : change,
      announcement: `${CHANGE_DONE[change]} ${formatCount(changedPlayers.length, `bracket`)}`,
    })
  }
  const changeRow = (
    sectionPlayers: ContestPlayer[],
    player: ContestPlayer,
    change: RowChange,
  ) => {
    setAnnouncement(``)
    submit([player], change, {
      subject: player.displayName,
      selectedIds: new Set([player.id]),
      focusTargetId:
        findNeighborId(sectionPlayers, player.id) ??
        (change === `DELETED` ? LIST_TARGET : player.id),
      announcement: `${CHANGE_DONE[change]} ${player.displayName}`,
    })
  }

  const duplicates = findPossibleDuplicates(players)
  const finish = (move: Move) => {
    remove(move)
    selection.remove(move.selectedIds)
    if (move === moves.at(-1)) {
      setAnnouncement(move.announcement)
      focusTarget(list.current!, move.focusTargetId)
    }
  }

  return (
    // Escape clears the selection from any of the list's controls
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div ref={list} className='flex flex-col gap-8' onKeyDown={clearOnEscape}>
      <p className='sr-only' aria-live='polite'>
        {announcement}
      </p>
      <p className='sr-only' aria-live='polite'>
        {isSelecting ? `${selection.players.length} selected` : ``}
      </p>
      {players.length === 0 ? <NoPlayers /> : null}
      {SECTIONS.map(status => {
        const title = describeStatus(status)
        const sectionPlayers = players.filter(
          player => player.status === status,
        )
        if (sectionPlayers.length === 0) {
          return null
        }
        return (
          <PlayerSection
            key={title}
            title={title}
            status={status}
            selection={{
              selectedCount: sectionPlayers.filter(({ id }) =>
                selection.ids.has(id),
              ).length,
              onChange: isSelected =>
                select(
                  sectionPlayers.map(({ id }) => id),
                  isSelected,
                ),
            }}
            action={
              status === `PENDING` ? (
                <ApprovePendingButton
                  players={sectionPlayers}
                  isDisabled={isSelecting}
                  isPending={sectionPlayers.some(({ id }) =>
                    pendingIds.has(id),
                  )}
                  onApprove={() => changeGroup(sectionPlayers, `APPROVED`)}
                />
              ) : null
            }
          >
            {sectionPlayers.map(player => (
              <PlayerRow
                key={player.id}
                contestId={contestId}
                player={player}
                duplicates={duplicates.get(player.id) ?? []}
                isSelected={selection.ids.has(player.id)}
                isSelecting={isSelecting}
                isPending={pendingIds.has(player.id)}
                onSelect={isSelected => select([player.id], isSelected)}
                onChange={change => changeRow(sectionPlayers, player, change)}
                onNewLink={() => setNewLinkPlayer(player)}
              />
            ))}
          </PlayerSection>
        )
      })}
      <NewPersonalLink
        contestId={contestId}
        player={newLinkPlayer}
        onClose={() => setNewLinkPlayer(null)}
      />
      <div className='sticky bottom-0 print:hidden'>
        <div className='border-2 border-ink bg-white px-4 py-3 empty:hidden'>
          {moves.map(move => (
            <MoveResult
              key={move.key}
              move={move}
              onDone={() => finish(move)}
            />
          ))}
        </div>
        {isSelecting ? (
          <SelectionBar
            players={selection.players}
            isPending={isSelectionPending}
            onChange={changeGroup}
            onClear={clearSelection}
          />
        ) : null}
      </div>
    </div>
  )
}

const NoPlayers = () => (
  <section className='flex flex-col gap-3'>
    <h2 tabIndex={-1} className={SECTION_HEADING_CLASS_NAME}>
      Players
    </h2>
    <p className='max-w-prose text-muted'>
      No one has started a bracket yet. Share the contest link with your
      players.
    </p>
  </section>
)

/** Focuses the list's first heading, for a move that leaves no row to focus */
const LIST_TARGET = `LIST`

const NO_IDS: ReadonlySet<string> = new Set()

/** The selected players, across sections */
const useSelection = (players: ContestPlayer[]) => {
  const [ids, setIds] = useState<ReadonlySet<string>>(NO_IDS)
  const remove = (removedIds: ReadonlySet<string>) =>
    setIds(current => current.difference(removedIds))
  return {
    ids,
    players: players.filter(({ id }) => ids.has(id)),
    change: (changedIds: string[], isSelected: boolean) => {
      const changed = new Set(changedIds)
      if (isSelected) {
        setIds(current => current.union(changed))
      } else {
        remove(changed)
      }
    },
    remove,
    clear: () => {
      // The bar takes focus with it when it closes
      if (document.activeElement?.closest(`[data-selection-bar]`)) {
        document.querySelector<HTMLElement>(`tbody input:checked`)?.focus()
      }
      setIds(NO_IDS)
    },
  }
}

const playerRowId = (playerId: string): string => `player-${playerId}`

/**
 * Rows on their way to another section, or to the trash. Its fetcher's `key` is
 * its own, so the fetcher's result is never an earlier move's
 */
type Move = {
  key: string
  playerIds: string[]
  /** The one player it moves, named in its error */
  subject?: string
  /** A row's player ID, a section's status, or LIST_TARGET */
  focusTargetId: string
  /** The players to unselect once the move is done */
  selectedIds: ReadonlySet<string>
  announcement: string
}

/** The moves in flight, and the refused ones */
const useMoves = (contestId: string) => {
  const [moves, setMoves] = useState<Move[]>([])
  const submitForm = useSubmit()
  const activeKeys = new Set(useFetchers().map(({ key }) => key))
  const isActive = ({ key }: Move) => activeKeys.has(key)

  const submit = (
    players: ContestPlayer[],
    change: RowChange,
    move: Omit<Move, `key` | `playerIds`>,
  ) => {
    const key = crypto.randomUUID()
    const playerIds = players.map(({ id }) => id)
    setMoves(current => [
      ...current.filter(isActive),
      { ...move, key, playerIds },
    ])
    const ids = joinIds(players)
    void submitForm(change === `DELETED` ? { ids } : { ids, status: change }, {
      method: `post`,
      action: href(
        change === `DELETED`
          ? `/contests/:contestId/players/delete`
          : `/contests/:contestId/players/status`,
        { contestId },
      ),
      navigate: false,
      fetcherKey: key,
    })
  }

  return {
    moves,
    pendingIds: new Set(
      moves.filter(isActive).flatMap(({ playerIds }) => playerIds),
    ),
    submit,
    remove: (removed: Move) =>
      setMoves(current => current.filter(move => move !== removed)),
    dismissErrors: () => setMoves(current => current.filter(isActive)),
  }
}

/** Falls back to the list when the move's own target is gone */
const focusTarget = (list: HTMLElement, targetId: string) => {
  const target = list.querySelector<HTMLElement>(
    `[data-focus-target="${CSS.escape(targetId)}"]`,
  )
  if (target) {
    ;(target.querySelector<HTMLElement>(`button:enabled`) ?? target).focus()
  } else {
    list.querySelector(`h2`)?.focus()
  }
}

/**
 * Shows a refused move's error, and calls `onDone` once a move succeeds. React
 * Router drops a move's result once no component reads it, so keep this mounted
 */
const MoveResult = ({
  move: { key, subject },
  onDone,
}: {
  move: Move
  onDone: () => void
}) => {
  const fetcher = useFetcher<ConfirmResult>({ key })
  const isDone =
    fetcher.state === `idle` &&
    fetcher.data !== undefined &&
    `ok` in fetcher.data
  // The page shows the moved rows before layout effects run
  useLayoutEffect(() => {
    if (isDone) {
      onDone()
    }
  }, [isDone, onDone])
  return <FetcherError fetcher={fetcher} subject={subject} />
}

const SelectionBar = ({
  players,
  isPending,
  onChange,
  onClear,
}: {
  players: ContestPlayer[]
  isPending: boolean
  onChange: (players: ContestPlayer[], change: RowChange) => void
  onClear: () => void
}) => (
  <fieldset
    aria-label='Selected brackets'
    data-selection-bar
    className='flex flex-wrap items-center gap-x-3 gap-y-2 border-2 border-ink bg-white px-4 py-3'
  >
    <p className='font-semibold tabular-nums'>{players.length} selected</p>
    <div className='me-auto'>
      <Button variant='quiet' isDisabled={isPending} onPress={onClear}>
        Clear
      </Button>
    </div>
    <div className='flex flex-wrap gap-3'>
      {DECISIONS.map(status => {
        const changedPlayers = players.filter(player =>
          listDecisions(player).includes(status),
        )
        return changedPlayers.length > 0 ? (
          <Button
            key={status}
            variant={status === `APPROVED` ? `primary` : `secondary`}
            isPending={isPending}
            onPress={() => onChange(changedPlayers, status)}
          >
            {DECISION_LABELS[status]} {changedPlayers.length}
          </Button>
        ) : null
      })}
      <DeletePlayersDialog
        players={players}
        onConfirm={() => onChange(players, `DELETED`)}
        trigger={
          <Button variant='secondary' isPending={isPending}>
            Delete {players.length}
          </Button>
        }
      />
    </div>
  </fieldset>
)

const DeletePlayersDialog = ({
  players,
  ...props
}: {
  players: ContestPlayer[]
  onConfirm: () => void
} & (
  | { trigger: ReactElement }
  | { isOpen: boolean; onOpenChange: (isOpen: boolean) => void }
)) => {
  const [first] = players
  const only = players.length === 1 ? first : undefined
  const count = formatCount(players.length, `bracket`)
  return (
    <ConfirmDialog
      {...props}
      title={
        only ? `Delete ${only.displayName}’s bracket?` : `Delete ${count}?`
      }
      confirmLabel={only ? `Delete bracket` : `Delete ${count}`}
    >
      <p>
        {only
          ? `It moves to this contest’s trash, and ${only.displayName}’s personal link stops working. You can restore it until next year’s bracket is published.`
          : `${listNames(players) ?? `The ${count}`} move to this contest’s trash, and their personal links stop working. You can restore them until next year’s bracket is published.`}
      </p>
    </ConfirmDialog>
  )
}

/** Null for too many to name */
const listNames = (players: ContestPlayer[]): string | null =>
  players.length <= 3
    ? LIST_FORMAT.format(players.map(({ displayName }) => displayName))
    : null

/** The next row, or the previous one for the last row */
const findNeighborId = (
  players: ContestPlayer[],
  playerId: string,
): string | null => {
  const index = players.findIndex(({ id }) => id === playerId)
  return (players[index + 1] ?? players[index - 1])?.id ?? null
}

const PlayerSection = ({
  title,
  status,
  selection,
  action,
  children,
}: {
  title: string
  status: SubmissionStatus | null
  selection: {
    selectedCount: number
    onChange: (isSelected: boolean) => void
  }
  action: React.ReactNode
  children: React.ReactNode[]
}) => {
  const headingId = useId()
  const isAllSelected = selection.selectedCount === children.length
  return (
    <section aria-labelledby={headingId} className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2
          id={headingId}
          data-focus-target={status ?? undefined}
          tabIndex={-1}
          className={SECTION_HEADING_CLASS_NAME}
        >
          {title}
          {` `}
          <span className='text-muted tabular-nums'>({children.length})</span>
        </h2>
        {action}
      </div>
      <table className='w-full table-fixed border-collapse max-sm:block'>
        <thead className='max-sm:block'>
          <tr className='border-b-2 border-ink text-start font-condensed text-sm font-bold tracking-wider text-muted uppercase max-sm:block'>
            {/* The rule misses the label inside the checkbox */}
            {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
            <td className='w-10 px-2 py-1.5 max-sm:block max-sm:w-auto max-sm:px-0 print:hidden'>
              <Checkbox
                isSelected={isAllSelected}
                isIndeterminate={selection.selectedCount > 0 && !isAllSelected}
                onChange={selection.onChange}
              >
                <span className='sm:sr-only'>{`Select all ${title.toLowerCase()}`}</span>
              </Checkbox>
            </td>
            <th className='px-2 py-1.5 text-start max-sm:hidden'>Name</th>
            <th className='w-44 px-2 py-1.5 text-start max-sm:hidden'>
              Started
            </th>
            <th className='w-48 px-2 py-1.5 max-sm:hidden md:w-80'>
              <span className='sr-only'>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className='max-sm:block'>{children}</tbody>
      </table>
    </section>
  )
}

const ApprovePendingButton = ({
  players,
  isDisabled,
  isPending,
  onApprove,
}: {
  players: ContestPlayer[]
  isDisabled: boolean
  isPending: boolean
  onApprove: () => void
}) => {
  const count = players.length
  const label = `Approve all ${count}`
  return (
    <ConfirmDialog
      trigger={
        <Button isDisabled={isDisabled} isPending={isPending}>
          {label}
        </Button>
      }
      title={`Approve ${formatCount(count, `pending bracket`)}?`}
      confirmLabel={label}
      confirmVariant='primary'
      onConfirm={onApprove}
    >
      <p>
        {`${listNames(players) ?? `The ${formatCount(count, `pending bracket`)}`} will be approved.`}
        {` `}
        You can reject any of them later.
      </p>
    </ConfirmDialog>
  )
}

const LIST_FORMAT = new Intl.ListFormat(`en-US`)

const PlayerRow = ({
  contestId,
  player,
  duplicates,
  isSelected,
  isSelecting,
  isPending,
  onSelect,
  onChange,
  onNewLink,
}: {
  contestId: string
  player: ContestPlayer
  duplicates: ContestPlayer[]
  isSelected: boolean
  /** Whether any row is selected, which turns off the row's own decisions */
  isSelecting: boolean
  isPending: boolean
  onSelect: (isSelected: boolean) => void
  onChange: (change: RowChange) => void
  onNewLink: () => void
}) => {
  const rename = useInlineEdit()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  return (
    <tr
      data-focus-target={player.id}
      id={playerRowId(player.id)}
      tabIndex={-1}
      className={`border-b border-muted-light max-sm:relative max-sm:grid max-sm:gap-1 max-sm:py-3 max-sm:ps-9 ${isSelected ? `bg-accent-soft/20 print:bg-transparent` : ``}`}
    >
      <td className='px-2 py-2 max-sm:absolute max-sm:start-0 max-sm:top-3 max-sm:p-0 print:hidden'>
        <Checkbox isSelected={isSelected} onChange={onSelect} hideLabel>
          {`Select ${player.displayName}`}
        </Checkbox>
      </td>
      <td className='px-2 py-2 font-semibold wrap-break-word max-sm:p-0'>
        {rename.isOpen ? (
          <RenameForm
            contestId={contestId}
            player={player}
            fetcher={rename.fetcher}
            onCancel={rename.close}
          />
        ) : (
          <>
            {player.displayName}
            {rename.isSaved ? (
              <output className='ms-2 font-normal text-accent-strong'>
                Saved
              </output>
            ) : null}
          </>
        )}
        <DuplicatesNote duplicates={duplicates} />
      </td>
      <td className='px-2 py-2 text-muted tabular-nums max-sm:p-0'>
        <span className='sm:sr-only'>Started </span>
        <LocalTime date={player.startedAt} format={formatDateTime} />
      </td>
      <td className='px-2 py-2 text-end max-sm:p-0 max-sm:pt-1 max-sm:text-start print:hidden'>
        {rename.isOpen ? null : (
          <div className='inline-flex flex-wrap justify-end gap-2 max-sm:justify-start'>
            {listDecisions(player).map(status => (
              <Button
                key={status}
                variant={status === `APPROVED` ? `primary` : `secondary`}
                isDisabled={isSelecting}
                isPending={isPending}
                aria-label={`${DECISION_LABELS[status]} ${player.displayName}`}
                onPress={() => onChange(status)}
              >
                {DECISION_LABELS[status]}
              </Button>
            ))}
            <PlayerMenu
              player={player}
              isPending={isPending}
              onRename={rename.open}
              onNewLink={onNewLink}
              onDelete={() => setIsConfirmingDelete(true)}
            />
            <DeletePlayersDialog
              players={[player]}
              isOpen={isConfirmingDelete}
              onOpenChange={setIsConfirmingDelete}
              onConfirm={() => onChange(`DELETED`)}
            />
          </div>
        )}
      </td>
    </tr>
  )
}

/**
 * Focusing the row scrolls to it. Following the link's fragment instead would
 * make `ScrollRestoration` restore an earlier page's scroll position
 */
const focusRow = (event: MouseEvent, playerId: string) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return
  }
  event.preventDefault()
  document.querySelector<HTMLElement>(`#${playerRowId(playerId)}`)?.focus()
}

const DuplicatesNote = ({ duplicates }: { duplicates: ContestPlayer[] }) =>
  duplicates.length > 0 ? (
    <p className='font-normal text-muted print:hidden'>
      This might be the same as{` `}
      {LIST_FORMAT.formatToParts(duplicates.map(({ id }) => id)).map(
        ({ type, value }, index) =>
          type === `element` ? (
            <a
              key={value}
              href={`#${playerRowId(value)}`}
              onClick={event => focusRow(event, value)}
            >
              {duplicates[index / 2]!.displayName}
            </a>
          ) : (
            value
          ),
      )}
    </p>
  ) : null

/** The row's less frequent actions */
const PlayerMenu = ({
  player,
  isPending,
  onRename,
  onNewLink,
  onDelete,
}: {
  player: ContestPlayer
  isPending: boolean
  onRename: () => void
  onNewLink: () => void
  onDelete: () => void
}) => (
  <MenuTrigger>
    <Button variant='secondary' aria-label={`More for ${player.displayName}`}>
      <span aria-hidden>•••</span>
    </Button>
    <Popover
      placement='bottom end'
      className='min-w-36 border-2 border-ink bg-white py-1 shadow-offset'
    >
      <Menu className='outline-none'>
        <MenuItem onAction={onRename} className={MENU_ITEM_CLASS_NAME}>
          Rename
        </MenuItem>
        <MenuItem onAction={onNewLink} className={MENU_ITEM_CLASS_NAME}>
          New personal link
        </MenuItem>
        <MenuItem
          isDisabled={isPending}
          onAction={onDelete}
          className={MENU_ITEM_CLASS_NAME}
        >
          Delete
        </MenuItem>
      </Menu>
    </Popover>
  </MenuTrigger>
)

const MENU_ITEM_CLASS_NAME = `cursor-pointer px-4 py-1.5 font-semibold outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focused:bg-accent-soft/40`

const PLAYER_NAME_SCHEMA = playerNameSchema(freeTextSchema)

const RenameForm = ({
  contestId,
  player,
  fetcher,
  onCancel,
}: {
  contestId: string
  player: ContestPlayer
  fetcher: FetcherWithComponents<SavedResult>
  onCancel: () => void
}) => {
  const { form, fields } = useValidatedForm(
    PLAYER_NAME_SCHEMA,
    fetcher.data?.result,
    { displayName: player.displayName },
  )
  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key === `Escape`) {
      // Keeps the list from also clearing the selection
      event.preventDefault()
      onCancel()
    }
  }
  return (
    <fetcher.Form
      method='post'
      action={href(`/contests/:contestId/players/:playerId/name`, {
        contestId,
        playerId: player.id,
      })}
      {...getFormProps(form)}
      onKeyDown={cancelOnEscape}
      className='flex flex-col gap-2'
    >
      <TextField
        {...fieldProps(fields.displayName)}
        label={`New name for ${player.displayName}`}
        hideLabel
        autoComplete='off'
        // The row opens for typing, as a Rename press asks
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
      <div className='flex gap-2'>
        <Button type='submit' isPending={fetcher.state !== `idle`}>
          Save
        </Button>
        <Button variant='secondary' onPress={onCancel}>
          Cancel
        </Button>
      </div>
      <FormError form={form} />
    </fetcher.Form>
  )
}
