import { getFormProps } from '@conform-to/react'
import { useId, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components'
import { href, useFetcher } from 'react-router'
import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
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
import { playerNameSchema } from '~/player-forms.ts'
import type { Decision } from '~/player-forms.ts'

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

/** The decisions each status's buttons make */
const CHANGES: Record<SubmissionStatus, Decision[]> = {
  PENDING: [`APPROVED`, `REJECTED`],
  APPROVED: [`REJECTED`],
  REJECTED: [`APPROVED`],
}

/**
 * Lists a contest's players in sections by status. Approving or rejecting
 * moves a row to its new section, so focus moves to the next row in the
 * section it left, and a screen reader hears the change
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

  const hasMoved = moving !== undefined && isShowingMove(moving, players)
  /**
   * Runs as React attaches the element that takes focus after the move, so
   * focus moves once the page shows the moved rows
   */
  const focusAfterMove =
    (kind: Moving[`kind`], targetId?: string) =>
    (element: HTMLElement | null) => {
      if (
        !element ||
        !hasMoved ||
        moving.kind !== kind ||
        (moving.kind === `decision` && moving.focusPlayerId !== targetId)
      ) {
        return
      }
      setMoving(undefined)
      setAnnouncement(moving.announcement)
      ;(element.querySelector<HTMLElement>(`button`) ?? element).focus()
    }

  return (
    <div className='flex flex-col gap-8'>
      <p className='sr-only' aria-live='polite'>
        {announcement}
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
            headingRef={
              status === `APPROVED` ? focusAfterMove(`approve-all`) : undefined
            }
            action={
              status === `PENDING` ? (
                <ApprovePendingButton
                  contestId={contestId}
                  players={sectionPlayers}
                  onApproving={() => {
                    // A saved rename leaves its row's editor open in state,
                    // and the row's new section would show it again
                    setEditingId(id =>
                      sectionPlayers.some(player => player.id === id)
                        ? undefined
                        : id,
                    )
                    setMoving({
                      kind: `approve-all`,
                      playerIds: sectionPlayers.map(({ id }) => id),
                      announcement: `Approved ${formatCount(sectionPlayers.length, `bracket`)}`,
                    })
                  }}
                />
              ) : null
            }
          >
            {sectionPlayers.map(player => (
              <PlayerRow
                key={player.id}
                contestId={contestId}
                player={player}
                rowRef={focusAfterMove(`decision`, player.id)}
                isEditing={player.id === editingId}
                setIsEditing={isEditing =>
                  setEditingId(isEditing ? player.id : undefined)
                }
                onDeciding={decision =>
                  setMoving({
                    kind: `decision`,
                    playerId: player.id,
                    status: decision,
                    focusPlayerId:
                      findNeighborId(sectionPlayers, player.id) ?? player.id,
                    announcement: `${DECISIONS[decision].done} ${player.displayName}`,
                  })
                }
              />
            ))}
          </PlayerSection>
        )
      })}
    </div>
  )
}

/** Rows waiting to move to another section once the page reloads them */
type Moving =
  | {
      kind: `decision`
      playerId: string
      status: Decision
      /** The next row in the section the player leaves, or the player */
      focusPlayerId: string
      announcement: string
    }
  | { kind: `approve-all`; playerIds: string[]; announcement: string }

const isShowingMove = (moving: Moving, players: ContestPlayer[]): boolean => {
  const statusOf = (playerId: string) =>
    players.find(({ id }) => id === playerId)?.status
  return moving.kind === `decision`
    ? statusOf(moving.playerId) === moving.status
    : moving.playerIds.some(id => statusOf(id) === `APPROVED`)
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
  action,
  children,
}: {
  title: string
  headingRef?: (element: HTMLHeadingElement | null) => void
  action: React.ReactNode
  children: React.ReactNode[]
}) => {
  const headingId = useId()
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
        <thead className='max-sm:hidden'>
          <tr className='border-b-2 border-ink text-start font-condensed text-sm font-bold tracking-wider text-muted uppercase'>
            <th className='w-1/3 px-2 py-1.5 text-start'>Name</th>
            <th className='w-1/3 px-2 py-1.5 text-start'>Started</th>
            <th className='px-2 py-1.5'>
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
  onApproving,
}: {
  contestId: string
  players: ContestPlayer[]
  onApproving: () => void
}) => {
  const fetcher = useFetcher<ConfirmResult>()
  const count = players.length
  const label = `Approve all ${count}`
  const approve = () => {
    onApproving()
    void fetcher.submit(
      { playerIds: players.map(({ id }) => id).join(`,`) },
      {
        method: `post`,
        action: href(`/contests/:contestId/approve-pending`, { contestId }),
      },
    )
  }
  return (
    <>
      <ConfirmDialog
        trigger={<Button isPending={fetcher.state !== `idle`}>{label}</Button>}
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
  rowRef,
  isEditing,
  setIsEditing,
  onDeciding,
}: {
  contestId: string
  player: ContestPlayer
  rowRef: (element: HTMLElement | null) => void
  isEditing: boolean
  setIsEditing: (isEditing: boolean) => void
  onDeciding: (status: Decision) => void
}) => {
  const rename = useInlineEdit(isEditing, setIsEditing)
  const statusFetcher = useFetcher<ConfirmResult>()

  const decide = (status: Decision) => {
    // A saved rename leaves the row's editor open in state, and the row's new
    // section would show it again
    if (isEditing) {
      setIsEditing(false)
    }
    onDeciding(status)
    void statusFetcher.submit(
      { status },
      {
        method: `post`,
        action: href(`/contests/:contestId/players/:playerId/status`, {
          contestId,
          playerId: player.id,
        }),
      },
    )
  }

  return (
    <tr
      ref={rowRef}
      className='border-b border-muted-light max-sm:grid max-sm:gap-1 max-sm:py-3'
    >
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
      </td>
      <td className='px-2 py-2 whitespace-nowrap text-muted tabular-nums max-sm:p-0'>
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
