import { useState } from 'react'
import {
  DialogTrigger,
  FieldError,
  Label,
  RadioButton,
  RadioField,
  RadioGroup,
} from 'react-aria-components'
import { useFetcher } from 'react-router'
import type { FetcherWithComponents } from 'react-router'
import { Button } from './button.tsx'
import { DialogError } from './fetcher-error.tsx'
import { BUTTONS_CLASS_NAME, ModalFrame } from './modal-frame.tsx'
import { Notice } from './notice.tsx'
import { SelectField } from './select-field.tsx'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { CONTEST_TARGET, listReasons, REASON_LABELS } from '~/report-forms.ts'
import type { ReportTarget } from '~/report-forms.ts'

/** Reports one of the targets to its contest's educator and the admin */
export const ReportDialog = ({
  action,
  targets,
}: {
  /** The route action that saves the report */
  action: string
  targets: [ReportTarget, ...ReportTarget[]]
}) => {
  const [isTriggerOpen, setIsTriggerOpen] = useState(false)
  const fetcher = useFetcher<ConfirmResult>()
  // Resetting a fetcher sets its data to null
  const isSent =
    fetcher.state === `idle` && Boolean(fetcher.data && `ok` in fetcher.data)

  const changeOpen = (isOpen: boolean) => {
    if (isOpen) {
      fetcher.reset()
    }
    setIsTriggerOpen(isOpen)
  }

  return (
    <div className='flex flex-col items-start gap-3 print:hidden'>
      <DialogTrigger
        isOpen={isTriggerOpen && !isSent}
        onOpenChange={changeOpen}
      >
        <Button variant='quiet'>Report a name</Button>
        <ModalFrame title='Report a name'>
          <ReportForm action={action} targets={targets} fetcher={fetcher} />
        </ModalFrame>
      </DialogTrigger>
      {isSent ? (
        <Notice kind='status'>Thanks. Your report was sent</Notice>
      ) : null}
    </div>
  )
}

/** Mounts with each opening, so the form starts empty */
const ReportForm = ({
  action,
  targets,
  fetcher,
}: {
  action: string
  targets: [ReportTarget, ...ReportTarget[]]
  fetcher: FetcherWithComponents<ConfirmResult>
}) => {
  const [target, setTarget] = useState(targets[0].id)
  return (
    <fetcher.Form method='post' action={action} className='flex flex-col gap-4'>
      {targets.length > 1 ? (
        <SelectField
          label='What do you want to report?'
          name='target'
          options={targets}
          value={target}
          onChange={setTarget}
        />
      ) : (
        <>
          <p className='font-semibold wrap-anywhere'>{targets[0].label}</p>
          <input type='hidden' name='target' value={target} />
        </>
      )}
      <RadioGroup
        // Starts over, since another target may lack the chosen reason
        key={String(target === CONTEST_TARGET.id)}
        name='reason'
        isRequired
        className='flex flex-col gap-2'
      >
        <Label className='font-semibold'>What’s wrong with it?</Label>
        {listReasons(target).map(reason => (
          <RadioField key={reason} value={reason}>
            <RadioButton className='group flex min-h-9 cursor-pointer items-center gap-3'>
              <span
                aria-hidden
                className='flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-ink outline-offset-2 group-data-focus-visible:outline-3 group-data-focus-visible:outline-accent-strong'
              >
                <span className='size-2.5 rounded-full group-data-selected:bg-ink' />
              </span>
              {REASON_LABELS[reason]}
            </RadioButton>
          </RadioField>
        ))}
        <FieldError className='font-semibold text-danger'>
          Choose what’s wrong with it
        </FieldError>
      </RadioGroup>
      <p>
        It goes to the contest’s educator and to MMMM. They aren’t told who sent
        it.
      </p>
      <div className={BUTTONS_CLASS_NAME}>
        <Button slot='close' variant='secondary'>
          Cancel
        </Button>
        <Button type='submit' isPending={fetcher.state !== `idle`}>
          Send report
        </Button>
      </div>
      <DialogError fetcher={fetcher} />
    </fetcher.Form>
  )
}
