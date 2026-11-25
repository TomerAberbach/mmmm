import { getFormProps } from '@conform-to/react'
import { useId, useState } from 'react'
import type { KeyboardEvent, MouseEvent, ReactElement } from 'react'
import { Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components'
import { href, useFetcher } from 'react-router'
import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
import { Checkbox } from './checkbox.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import type { ConfirmResult } from './confirm-dialog.tsx'
import { FetcherError } from './fetcher-error.tsx'
import { FormError } from './form-error.tsx'
import { LocalTime } from './local-time.tsx'
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

/** Each decision's button, and what a screen reader hears once it's made */
const DECISIONS: Record<Decision, { label: string; done: string }> = {
  APPROVED: { label: `Approve`, done: `Approved` },
  REJECTED: { label: `Reject`, done: `Rejected` },
}

const DECISION_ORDER: Decision[] = [`APPROVED`, `REJECTED`]

/** The decisions each status's buttons make */
const CHANGES: Record<SubmissionStatus, Decision[]> = {
  PENDING: [`APPROVED`, `REJECTED`],
  APPROVED: [`REJECTED`],
  REJECTED: [`APPROVED`],
}

/** A draft can't be approved or rejected */
const listChanges = ({ status }: ContestPlayer): Decision[] =>
  status ? CHANGES[status] : []

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
  const [editingId, setEditingId] = useState<string>()
  const [announcement, setAnnouncement] = useState(``)
  const [moving, setMoving] = useState<Moving>()
  const selection = useSelection(players)

  const isSelecting = selection.players.length > 0
  const clearOnEscape = (event: KeyboardEvent) => {
    if (event.key === `Escape` && !event.defaultPrevented && isSelecting) {
      selection.clear()
    }
  }

  const startMove = (move: Moving) => {
    // A saved rename leaves its row's editor open in state, and the row's new
    // section would show it again
    setEditingId(id =>
      id !== undefined && move.playerIds.includes(id) ? undefined : id,
    )
    setAnnouncement(``)
    setMoving(move)
  }
  const startGroupMove = (movingPlayers: ContestPlayer[], status: Decision) =>
    startMove({
      playerIds: movingPlayers.map(({ id }) => id),
      selectedIds: selection.ids,
      status,
      focusTargetId: status,
      announcement: `${DECISIONS[status].done} ${formatCount(movingPlayers.length, `bracket`)}`,
    })

  const startGroupDelete = (deletedPlayers: ContestPlayer[]) =>
    startMove({
      playerIds: deletedPlayers.map(({ id }) => id),
      selectedIds: selection.ids,
      status: `DELETED`,
      focusTargetId: LIST_TARGET,
      announcement: `Deleted ${formatCount(deletedPlayers.length, `bracket`)}`,
    })

  const duplicates = findPossibleDuplicates(players)
  const hasMoved = moving !== undefined && isShowingMove(moving, players)
  /**
   * Runs as React attaches the element that takes focus after the move, so
   * focus moves once the page shows the moved rows
   */
  const focusAfterMove =
    (targetId: string | null) => (element: HTMLElement | null) => {
      if (!element || !hasMoved || moving.focusTargetId !== targetId) {
        return
      }
      setMoving(undefined)
      selection.remove(moving.selectedIds)
      setAnnouncement(moving.announcement)
      const target = targetId === LIST_TARGET ? `h2` : `button:enabled`
      ;(element.querySelector<HTMLElement>(target) ?? element).focus()
    }

  return (
    // Escape clears the selection from any of the list's controls
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={focusAfterMove(LIST_TARGET)}
      className='flex flex-col gap-8'
      onKeyDown={clearOnEscape}
    >
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
            headingRef={focusAfterMove(status)}
            selection={{
              label: `Select all ${title.toLowerCase()}`,
              selectedCount: sectionPlayers.filter(({ id }) =>
                selection.ids.has(id),
              ).length,
              onChange: isSelected =>
                selection.change(
                  sectionPlayers.map(({ id }) => id),
                  isSelected,
                ),
            }}
            action={
              status === `PENDING` ? (
                <ApprovePendingButton
                  contestId={contestId}
                  players={sectionPlayers}
                  isDisabled={isSelecting}
                  onApproving={() => startGroupMove(sectionPlayers, `APPROVED`)}
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
                onSelect={isSelected =>
                  selection.change([player.id], isSelected)
                }
                rowRef={focusAfterMove(player.id)}
                isEditing={player.id === editingId}
                setIsEditing={isEditing =>
                  setEditingId(isEditing ? player.id : undefined)
                }
                onDeciding={decision =>
                  startMove({
                    playerIds: [player.id],
                    selectedIds: new Set([player.id]),
                    status: decision,
                    focusTargetId:
                      findNeighborId(sectionPlayers, player.id) ?? player.id,
                    announcement: `${DECISIONS[decision].done} ${player.displayName}`,
                  })
                }
                onDeleting={() =>
                  startMove({
                    playerIds: [player.id],
                    selectedIds: new Set([player.id]),
                    status: `DELETED`,
                    focusTargetId:
                      findNeighborId(sectionPlayers, player.id) ?? LIST_TARGET,
                    announcement: `Deleted ${player.displayName}`,
                  })
                }
              />
            ))}
          </PlayerSection>
        )
      })}
      {isSelecting ? (
        <SelectionBar
          contestId={contestId}
          players={selection.players}
          fetcher={selection.fetcher}
          onDeciding={startGroupMove}
          onDeleting={startGroupDelete}
          onClear={selection.clear}
        />
      ) : null}
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

/** The selected players, across sections, and the request that decides them */
const useSelection = (players: ContestPlayer[]) => {
  const [ids, setIds] = useState<ReadonlySet<string>>(NO_IDS)
  const fetcher = useFetcher<ConfirmResult>()
  const isDeciding = fetcher.state !== `idle`

  const change = (changedIds: string[], isSelected: boolean) => {
    // An error describes the selection it refused, not a changed one
    if (fetcher.data && !isDeciding) {
      fetcher.reset()
    }
    const changed = new Set(changedIds)
    setIds(current =>
      isSelected ? current.union(changed) : current.difference(changed),
    )
  }

  const clear = () => {
    // The bar stays open to show an error
    if (isDeciding) {
      return
    }
    fetcher.reset()
    // The bar takes focus with it when it closes
    if (document.activeElement?.closest(`[data-selection-bar]`)) {
      document.querySelector<HTMLElement>(`tbody input:checked`)?.focus()
    }
    setIds(NO_IDS)
  }

  return {
    ids,
    players: players.filter(({ id }) => ids.has(id)),
    fetcher,
    change,
    remove: (removedIds: ReadonlySet<string>) =>
      setIds(current => current.difference(removedIds)),
    clear,
  }
}

const playerRowId = (playerId: string): string => `player-${playerId}`

/**
 * Rows waiting to move to another section, or to the trash, once the page
 * reloads them
 */
type Moving = {
  playerIds: string[]
  status: Decision | `DELETED`
  /** A row's player ID, a section's status, or LIST_TARGET */
  focusTargetId: string
  /** The players to unselect once the move is done */
  selectedIds: ReadonlySet<string>
  announcement: string
}

const isShowingMove = (moving: Moving, players: ContestPlayer[]): boolean =>
  moving.status === `DELETED`
    ? !players.some(({ id }) => moving.playerIds.includes(id))
    : players.some(
        ({ id, status }) =>
          moving.playerIds.includes(id) && status === moving.status,
      )

const submitStatus = (
  fetcher: FetcherWithComponents<ConfirmResult>,
  contestId: string,
  players: ContestPlayer[],
  status: Decision,
) => {
  void fetcher.submit(
    { status, ids: joinIds(players) },
    {
      method: `post`,
      action: href(`/contests/:contestId/players/status`, { contestId }),
    },
  )
}

const submitDelete = (
  fetcher: FetcherWithComponents<ConfirmResult>,
  contestId: string,
  players: ContestPlayer[],
) => {
  void fetcher.submit(
    { ids: joinIds(players) },
    {
      method: `post`,
      action: href(`/contests/:contestId/players/delete`, { contestId }),
    },
  )
}

/** Stays at the window's bottom while the list scrolls under it */
const SelectionBar = ({
  contestId,
  players,
  fetcher,
  onDeciding,
  onDeleting,
  onClear,
}: {
  contestId: string
  players: ContestPlayer[]
  fetcher: FetcherWithComponents<ConfirmResult>
  onDeciding: (players: ContestPlayer[], status: Decision) => void
  onDeleting: (players: ContestPlayer[]) => void
  onClear: () => void
}) => {
  const decide = (changedPlayers: ContestPlayer[], status: Decision) => {
    onDeciding(changedPlayers, status)
    submitStatus(fetcher, contestId, changedPlayers, status)
  }
  const deleteAll = () => {
    onDeleting(players)
    submitDelete(fetcher, contestId, players)
  }
  return (
    <fieldset
      aria-label='Selected brackets'
      data-selection-bar
      className='sticky bottom-0 flex flex-wrap items-center gap-x-3 gap-y-2 border-2 border-ink bg-white px-4 py-3 print:hidden'
    >
      <p className='font-semibold tabular-nums'>{players.length} selected</p>
      <div className='me-auto'>
        <Button
          variant='quiet'
          isDisabled={fetcher.state !== `idle`}
          onPress={onClear}
        >
          Clear
        </Button>
      </div>
      <div className='flex flex-wrap gap-3'>
        {DECISION_ORDER.map(status => {
          const changedPlayers = players.filter(player =>
            listChanges(player).includes(status),
          )
          return changedPlayers.length > 0 ? (
            <Button
              key={status}
              variant={status === `APPROVED` ? `primary` : `secondary`}
              isPending={fetcher.state !== `idle`}
              onPress={() => decide(changedPlayers, status)}
            >
              {DECISIONS[status].label} {changedPlayers.length}
            </Button>
          ) : null
        })}
        <DeletePlayersDialog
          players={players}
          onConfirm={deleteAll}
          trigger={
            <Button variant='secondary' isPending={fetcher.state !== `idle`}>
              Delete {players.length}
            </Button>
          }
        />
      </div>
      <FetcherError fetcher={fetcher} />
    </fieldset>
  )
}

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
  headingRef,
  selection,
  action,
  children,
}: {
  title: string
  headingRef: (element: HTMLHeadingElement | null) => void
  selection: {
    label: string
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
          ref={headingRef}
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
                <span className='sm:sr-only'>{selection.label}</span>
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
  contestId,
  players,
  isDisabled,
  onApproving,
}: {
  contestId: string
  players: ContestPlayer[]
  isDisabled: boolean
  onApproving: () => void
}) => {
  const fetcher = useFetcher<ConfirmResult>()
  const count = players.length
  const label = `Approve all ${count}`
  const approve = () => {
    onApproving()
    void fetcher.submit(
      { ids: joinIds(players) },
      {
        method: `post`,
        action: href(`/contests/:contestId/approve-pending`, { contestId }),
      },
    )
  }
  return (
    <>
      <ConfirmDialog
        trigger={
          <Button isDisabled={isDisabled} isPending={fetcher.state !== `idle`}>
            {label}
          </Button>
        }
        title={`Approve ${formatCount(count, `pending bracket`)}?`}
        confirmLabel={label}
        confirmVariant='primary'
        onConfirm={approve}
      >
        <p>
          {`${listNames(players) ?? `The ${formatCount(count, `pending bracket`)}`} will be approved.`}
          {` `}
          You can reject any of them later.
        </p>
      </ConfirmDialog>
      <FetcherError fetcher={fetcher} />
    </>
  )
}

const LIST_FORMAT = new Intl.ListFormat(`en-US`)

const PlayerRow = ({
  contestId,
  player,
  duplicates,
  isSelected,
  isSelecting,
  onSelect,
  rowRef,
  isEditing,
  setIsEditing,
  onDeciding,
  onDeleting,
}: {
  contestId: string
  player: ContestPlayer
  duplicates: ContestPlayer[]
  isSelected: boolean
  /** Whether any row is selected, which turns off the row's own decisions */
  isSelecting: boolean
  onSelect: (isSelected: boolean) => void
  rowRef: (element: HTMLElement | null) => void
  isEditing: boolean
  setIsEditing: (isEditing: boolean) => void
  onDeciding: (status: Decision) => void
  onDeleting: () => void
}) => {
  const rename = useInlineEdit(isEditing, setIsEditing)
  const rowFetcher = useFetcher<ConfirmResult>()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const decide = (status: Decision) => {
    onDeciding(status)
    submitStatus(rowFetcher, contestId, [player], status)
  }
  const deletePlayer = () => {
    onDeleting()
    submitDelete(rowFetcher, contestId, [player])
  }

  return (
    <tr
      ref={rowRef}
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
            {listChanges(player).map(status => (
              <Button
                key={status}
                variant={status === `APPROVED` ? `primary` : `secondary`}
                isDisabled={isSelecting}
                isPending={rowFetcher.state !== `idle`}
                aria-label={`${DECISIONS[status].label} ${player.displayName}`}
                onPress={() => decide(status)}
              >
                {DECISIONS[status].label}
              </Button>
            ))}
            <PlayerMenu
              player={player}
              onRename={rename.open}
              onDelete={() => setIsConfirmingDelete(true)}
            />
            <DeletePlayersDialog
              players={[player]}
              isOpen={isConfirmingDelete}
              onOpenChange={setIsConfirmingDelete}
              onConfirm={deletePlayer}
            />
          </div>
        )}
        <FetcherError fetcher={rowFetcher} />
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
  onRename,
  onDelete,
}: {
  player: ContestPlayer
  onRename: () => void
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
      <Menu
        className='outline-none'
        onAction={key => (key === `rename` ? onRename() : onDelete())}
      >
        <MenuItem id='rename' className={MENU_ITEM_CLASS_NAME}>
          Rename
        </MenuItem>
        <MenuItem id='delete' className={MENU_ITEM_CLASS_NAME}>
          Delete
        </MenuItem>
      </Menu>
    </Popover>
  </MenuTrigger>
)

const MENU_ITEM_CLASS_NAME = `cursor-pointer px-4 py-1.5 font-semibold outline-none data-focused:bg-accent-soft/40`

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
