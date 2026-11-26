import { href } from 'react-router'
import {
  AdminContestActions,
  describeAdminContest,
} from './admin-contest-actions.tsx'
import { Button } from './button.tsx'
import { ContestNameForm } from './contest-name-form.tsx'
import { Notice } from './notice.tsx'
import { PageHeader } from './page-header.tsx'
import { useInlineEdit } from './use-inline-edit.ts'
import type { AdminContest } from '~/admin-contests.server.ts'

/** A contest's name, which Rename edits, its details, and the admin's actions */
export const AdminContestHeader = ({ contest }: { contest: AdminContest }) => {
  const { fetcher, isOpen, isSaved, open, close } = useInlineEdit()
  return (
    <div className='flex flex-col gap-3'>
      <PageHeader
        title={contest.name}
        action={
          <div className='flex flex-wrap gap-2'>
            {isOpen ? null : (
              <Button variant='quiet' onPress={open}>
                Rename
              </Button>
            )}
            <AdminContestActions contest={contest} />
          </div>
        }
      />
      <p className='wrap-anywhere text-muted'>
        {describeAdminContest(contest)}
      </p>
      {isOpen ? (
        <ContestNameForm
          fetcher={fetcher}
          action={href(`/admin/contests/:contestId/name`, {
            contestId: contest.id,
          })}
          submitLabel='Save'
          defaultName={contest.name}
          onCancel={close}
        />
      ) : null}
      {isSaved ? <Notice kind='status'>Saved the contest name</Notice> : null}
    </div>
  )
}
