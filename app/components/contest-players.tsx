import { getFormProps } from '@conform-to/react'
import { useId, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components'
import { href, useFetcher } from 'react-router'
import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
import { Checkbox } from './checkbox.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import type { ConfirmResult } from './confirm-dialog.tsx'
import { FormError } from './form-error.tsx'
import { LocalTime } from './local-time.tsx'
import { SECTION_HEADING_CLASS_NAME } from './settings-section.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useInlineEdit } from './use-inline-edit.ts'
import { useValidatedForm } from './use-validated-form.ts'
import type { ContestPlayer } from '~/contest-players.server.ts'
import { formatDateTime } from '~/dates.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { freeTextSchema } from '~/free-text.ts'
import type { SubmissionStatus } from '~/generated/prisma/browser.ts'
import { joinPlayerIds, playerNameSchema } from '~/player-forms.ts'
import type { Decision } from '~/player-forms.ts'
import { findPossibleDuplicates } from '~/possible-duplicates.ts'

/** Each section's players, by submission status, or null for drafts */
const SECTIONS: { status: SubmissionStatus | null; title: string }[] = [
  { status: `PENDING`, title: `Pending` },
  { status: `APPROVED`, title: `Approved` },
  { status: `REJECTED`, title: `Rejected` },
  { status: null, title: `Started, not submitted` },
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

/**
 * Lists a contest's players in sections by status. Approving or rejecting
 * moves a row to its new section, so focus moves to the next row in the
 * section it left, and a screen reader hears the change. Selecting rows, in
 * any sections, opens a bar that approves or rejects them together
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

  if (players.length === 0) {
    return (
      <section className='flex flex-col gap-3'>
        <h2 className={SECTION_HEADING_CLASS_NAME}>Players</h2>
        <p className='max-w-prose text-muted'>
          No one has started a bracket yet. Share the contest link with your
          players.
        </p>
      </section>
    )
  }

  const isSelecting = selection.players.length > 0
  const clearOnEscape = (event: KeyboardEvent) => {
    if (event.key === `Escape` && !event.defaultPrevented && isSelecting) {
      selection.clear()
    }
  }

  const startMove = (move: Omit<Moving, `selectedIds`>) => {
    // A saved rename leaves its row's editor open in state, and the row's new
    // section would show it again
    setEditingId(id =>
      id !== undefined && move.playerIds.includes(id) ? undefined : id,
    )
    setAnnouncement(``)
    setMoving({ ...move, selectedIds: selection.ids })
  }
  const startGroupMove = (movingPlayers: ContestPlayer[], status: Decision) =>
    startMove({
      playerIds: movingPlayers.map(({ id }) => id),
      status,
      focusTargetId: status,
      announcement: `${DECISIONS[status].done} ${formatCount(movingPlayers.length, `bracket`)}`,
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
      ;(element.querySelector<HTMLElement>(`button:enabled`) ?? element).focus()
    }

  return (
    // Escape clears the selection from any of the list's controls
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className='flex flex-col gap-8' onKeyDown={clearOnEscape}>
      <p className='sr-only' aria-live='polite'>
        {announcement}
      </p>
      <p className='sr-only' aria-live='polite'>
        {isSelecting ? `${selection.players.length} selected` : ``}
      </p>
      {SECTIONS.map(({ status, title }) => {
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
            selection={
              status === null
                ? null
                : {
                    label: `Select all ${title.toLowerCase()}`,
                    selectedCount: sectionPlayers.filter(({ id }) =>
                      selection.ids.has(id),
                    ).length,
                    onChange: isSelected =>
                      selection.change(
                        sectionPlayers.map(({ id }) => id),
                        isSelected,
                      ),
                  }
            }
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
                    status: decision,
                    focusTargetId:
                      findNeighborId(sectionPlayers, player.id) ?? player.id,
                    announcement: `${DECISIONS[decision].done} ${player.displayName}`,
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
          onClear={selection.clear}
        />
      ) : null}
    </div>
  )
}

const NO_IDS: ReadonlySet<string> = new Set()

/** Drafts can't be approved or rejected, so only submitted players are selected */
type SubmittedPlayer = ContestPlayer & { status: SubmissionStatus }

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
    players: players.filter(
      (player): player is SubmittedPlayer =>
        player.status !== null && ids.has(player.id),
    ),
    fetcher,
    change,
    remove: (removedIds: ReadonlySet<string>) =>
      setIds(current => current.difference(removedIds)),
    clear,
  }
}

const playerRowId = (playerId: string): string => `player-${playerId}`

/** Rows waiting to move to another section once the page reloads them */
type Moving = {
  playerIds: string[]
  status: Decision
  /** The ID of the player whose row takes focus, or a section's status */
  focusTargetId: string
  /** The selection when the move began, which clears once it's done */
  selectedIds: ReadonlySet<string>
  announcement: string
}

const isShowingMove = (moving: Moving, players: ContestPlayer[]): boolean =>
  players.some(
    ({ id, status }) =>
      moving.playerIds.includes(id) && status === moving.status,
  )

/** Stays at the window's bottom while the list scrolls under it */
const SelectionBar = ({
  contestId,
  players,
  fetcher,
  onDeciding,
  onClear,
}: {
  contestId: string
  players: SubmittedPlayer[]
  fetcher: FetcherWithComponents<ConfirmResult>
  onDeciding: (players: SubmittedPlayer[], status: Decision) => void
  onClear: () => void
}) => {
  const decide = (changedPlayers: SubmittedPlayer[], status: Decision) => {
    onDeciding(changedPlayers, status)
    void fetcher.submit(
      { status, playerIds: joinPlayerIds(changedPlayers) },
      {
        method: `post`,
        action: href(`/contests/:contestId/players/status`, { contestId }),
      },
    )
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
            CHANGES[player.status].includes(status),
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
      </div>
      <FetcherError fetcher={fetcher} />
    </fieldset>
  )
}

/** Such as "1 bracket" or "3 pending brackets" */
const formatCount = (count: number, noun: string): string =>
  count === 1 ? `1 ${noun}` : `${count} ${noun}s`

/** A ConfirmResult's error, once its request finishes */
const FetcherError = ({
  fetcher,
}: {
  fetcher: FetcherWithComponents<ConfirmResult>
}) =>
  fetcher.state === `idle` && fetcher.data && `error` in fetcher.data ? (
    <p role='alert' className='mt-1 font-semibold text-danger'>
      {fetcher.data.error}
    </p>
  ) : null

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
  /** Null for players who can't be selected */
  selection: {
    label: string
    selectedCount: number
    onChange: (isSelected: boolean) => void
  } | null
  action: React.ReactNode
  children: React.ReactNode[]
}) => {
  const headingId = useId()
  const isAllSelected = selection?.selectedCount === children.length
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
            <td className='w-10 px-2 py-1.5 max-sm:block max-sm:w-auto max-sm:px-0 print:hidden'>
              {selection ? (
                <Checkbox
                  isSelected={isAllSelected}
                  isIndeterminate={
                    selection.selectedCount > 0 && !isAllSelected
                  }
                  onChange={selection.onChange}
                >
                  <span className='sm:sr-only'>{selection.label}</span>
                </Checkbox>
              ) : null}
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
      { playerIds: joinPlayerIds(players) },
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
          {count <= 3
            ? `${LIST_FORMAT.format(players.map(({ displayName }) => displayName))} will be approved.`
            : `The ${formatCount(count, `pending bracket`)} will be approved.`}
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
}) => {
  const rename = useInlineEdit(isEditing, setIsEditing)
  const statusFetcher = useFetcher<ConfirmResult>()

  const decide = (status: Decision) => {
    onDeciding(status)
    void statusFetcher.submit(
      { status, playerIds: joinPlayerIds([player]) },
      {
        method: `post`,
        action: href(`/contests/:contestId/players/status`, { contestId }),
      },
    )
  }

  return (
    <tr
      ref={rowRef}
      id={playerRowId(player.id)}
      tabIndex={-1}
      className={`border-b border-muted-light max-sm:relative max-sm:grid max-sm:gap-1 max-sm:py-3 max-sm:ps-9 ${isSelected ? `bg-accent-soft/20 print:bg-transparent` : ``}`}
    >
      <td className='px-2 py-2 max-sm:absolute max-sm:start-0 max-sm:top-3 max-sm:p-0 print:hidden'>
        {player.status ? (
          <Checkbox isSelected={isSelected} onChange={onSelect} hideLabel>
            {`Select ${player.displayName}`}
          </Checkbox>
        ) : null}
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
            {player.status
              ? CHANGES[player.status].map(status => (
                  <Button
                    key={status}
                    variant={status === `APPROVED` ? `primary` : `secondary`}
                    isDisabled={isSelecting}
                    isPending={statusFetcher.state !== `idle`}
                    aria-label={`${DECISIONS[status].label} ${player.displayName}`}
                    onPress={() => decide(status)}
                  >
                    {DECISIONS[status].label}
                  </Button>
                ))
              : null}
            <PlayerMenu player={player} onRename={rename.open} />
          </div>
        )}
        <FetcherError fetcher={statusFetcher} />
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
}: {
  player: ContestPlayer
  onRename: () => void
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
        onAction={key => {
          if (key === `rename`) {
            onRename()
          }
        }}
      >
        <MenuItem
          id='rename'
          className='cursor-pointer px-4 py-1.5 font-semibold outline-none data-focused:bg-accent-soft/40'
        >
          Rename
        </MenuItem>
      </Menu>
    </Popover>
  </MenuTrigger>
)

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
