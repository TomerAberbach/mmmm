import { useState } from 'react'
import { Link, useFetcher } from 'react-router'
import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
import { ContestNameForm } from './contest-name-form.tsx'
import { CopyButton } from './copy-button.tsx'
import { Notice } from './notice.tsx'
import { PageHeader } from './page-header.tsx'
import { QrCode } from './qr-code.tsx'
import type { SavedResult } from './saved-notice.tsx'
import { SettingsSection } from './settings-section.tsx'
import { TextField } from './text-field.tsx'
import type { Contest } from '~/contests.server.ts'

export const ContestDetails = ({ contest }: { contest: Contest }) => (
  <div className='flex max-w-3xl flex-col gap-8'>
    <Link to='/contests' className='self-start'>
      All contests
    </Link>
    <ContestName contest={contest} />
    <ContestLink link={contest.link} />
  </div>
)

// Rename opens the name's field below the heading until the save succeeds
const ContestName = ({ contest }: { contest: Contest }) => {
  const [isEditing, setIsEditing] = useState(false)
  const fetcher = useFetcher<SavedResult>()
  const isSaved = fetcher.state === `idle` && fetcher.data?.saved === true
  const isFormOpen = isEditing && !isSaved
  const startEditing = () => {
    fetcher.reset()
    setIsEditing(true)
  }

  return (
    <div className='flex flex-col gap-3'>
      <PageHeader
        label={`${contest.yearId} contest`}
        title={contest.name}
        action={
          isFormOpen ? null : (
            <Button variant='secondary' onPress={startEditing}>
              Rename
            </Button>
          )
        }
      />
      {isFormOpen ? (
        <RenameForm
          contest={contest}
          fetcher={fetcher}
          onCancel={() => setIsEditing(false)}
        />
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
    action={`/contests/${id}/name`}
    submitLabel='Save'
    defaultName={name}
    cancelButton={
      <Button variant='secondary' onPress={onCancel}>
        Cancel
      </Button>
    }
    onKeyDown={event => {
      if (event.key === `Escape`) {
        onCancel()
      }
    }}
  />
)

const ContestLink = ({ link }: { link: string }) => (
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
  </SettingsSection>
)
