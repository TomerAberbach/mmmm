import { href, Link } from 'react-router'
import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { ContestNameForm } from './contest-name-form.tsx'
import { ContestPlayers } from './contest-players.tsx'
import { CopyButton } from './copy-button.tsx'
import { Notice } from './notice.tsx'
import { PageHeader } from './page-header.tsx'
import { QrCode } from './qr-code.tsx'
import { SettingsSection } from './settings-section.tsx'
import { TextField } from './text-field.tsx'
import { useInlineEdit } from './use-inline-edit.ts'
import type { ContestPlayer } from '~/contest-players.server.ts'
import type { Contest } from '~/contests.server.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { formatCount } from '~/format-count.ts'

export const ContestDetails = ({
  contest,
  players,
  deletedCount,
}: {
  contest: Contest
  players: ContestPlayer[]
  /** How many players are in the contest's trash */
  deletedCount: number
}) => (
  <div className='flex max-w-3xl flex-col gap-8'>
    <Link to={href(`/contests`)} className='self-start print:hidden'>
      All contests
    </Link>
    <ContestName contest={contest} />
    <ContestLink contest={contest} />
    <ContestPlayers contestId={contest.id} players={players} />
    <div className='flex flex-wrap items-center justify-between gap-4 border-t-2 border-ink pt-4 print:hidden'>
      <Link to={href(`/contests/:contestId/trash`, { contestId: contest.id })}>
        {`Trash (${deletedCount})`}
      </Link>
      <DeleteContestButton contest={contest} players={players} />
    </div>
  </div>
)

/** Rename opens the name's field below the heading until the save succeeds */
const ContestName = ({ contest }: { contest: Contest }) => {
  const { fetcher, isOpen, isSaved, open, close } = useInlineEdit()

  return (
    <div className='flex flex-col gap-3'>
      <PageHeader
        label={`${contest.year} contest`}
        title={contest.name}
        action={
          isOpen ? null : (
            <Button variant='secondary' onPress={open}>
              Rename
            </Button>
          )
        }
      />
      {isOpen ? (
        <RenameForm contest={contest} fetcher={fetcher} onCancel={close} />
      ) : null}
      {isSaved ? <Notice kind='status'>Saved the contest name</Notice> : null}
    </div>
  )
}

const RenameForm = ({
  contest: { id, name },
  fetcher,
  onCancel,
}: {
  contest: Contest
  fetcher: FetcherWithComponents<SavedResult>
  onCancel: () => void
}) => (
  <ContestNameForm
    fetcher={fetcher}
    action={href(`/contests/:contestId/name`, { contestId: id })}
    submitLabel='Save'
    defaultName={name}
    onCancel={onCancel}
  />
)

const DeleteContestButton = ({
  contest: { id, name },
  players,
}: {
  contest: Contest
  players: ContestPlayer[]
}) => {
  const submissionCount = players.filter(({ status }) => status !== null).length
  const draftCount = players.length - submissionCount
  return (
    <ConfirmDialog
      trigger={<Button variant='secondary'>Delete contest</Button>}
      title={`Delete ${name}?`}
      confirmLabel='Delete contest'
      action={href(`/contests/:contestId/delete`, { contestId: id })}
    >
      <p>
        {`Its ${formatCount(submissionCount, `submission`)} and ${formatCount(draftCount, `draft`)} go with it, and its contest link and personal links stop working. You can restore it until next year’s bracket is published.`}
      </p>
    </ConfirmDialog>
  )
}

const ContestLink = ({ contest: { id, link } }: { contest: Contest }) => (
  <SettingsSection title='Contest link'>
    <p className='max-w-prose'>
      Share this link with your players. Anyone with it can fill out a bracket,
      so post it where only your players see it.
    </p>
    <TextField
      label='Contest link'
      hideLabel
      value={link}
      isReadOnly
      onFocus={event => event.target.select()}
    >
      <CopyButton text={link} />
    </TextField>
    <details className='flex flex-col gap-3'>
      <summary className='cursor-pointer self-start font-semibold'>
        Show a QR code
      </summary>
      <div className='flex flex-wrap items-center gap-5 pt-3'>
        <QrCode value={link} label='QR code for the contest link' />
        <p className='max-w-xs text-muted'>
          For a projector or a printed handout. Players scan it with a phone or
          tablet camera.
        </p>
      </div>
    </details>
    <NewContestLink key={id} contestId={id} />
  </SettingsSection>
)

const NewContestLink = ({ contestId }: { contestId: string }) => (
  <div className='flex flex-col items-start gap-3'>
    <ConfirmDialog
      trigger={<Button variant='secondary'>New contest link</Button>}
      title='Replace the contest link?'
      confirmLabel='Create new link'
      action={href(`/contests/:contestId/link`, { contestId })}
      successNotice='Created a new contest link. The old one no longer works'
    >
      <p>
        The old link stops working, so share the new one with your players.
        Players who already started keep their personal links.
      </p>
    </ConfirmDialog>
  </div>
)
