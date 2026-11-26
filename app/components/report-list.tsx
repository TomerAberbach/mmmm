import { useEffect, useRef } from 'react'
import { Link, useFetcher } from 'react-router'
import { Button } from './button.tsx'
import { FetcherError } from './fetcher-error.tsx'
import { LocalTime } from './local-time.tsx'
import { formatDate } from '~/dates.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { CONTEST_TARGET, REASON_LABELS } from '~/report-forms.ts'
import type { ReportItem } from '~/reports.server.ts'

/** Reports, each with Dismiss and a link to what it's about */
export const ReportList = ({
  reports,
  dismissPath,
  toLink,
}: {
  reports: ReportItem[]
  /** The route action that dismisses a report */
  dismissPath: string
  toLink: (report: ReportItem) => { to: string; label: string }
}) => {
  const fetcher = useFetcher<ConfirmResult>()
  const list = useRef<HTMLElement>(null)
  const isDismissed =
    fetcher.state === `idle` && Boolean(fetcher.data && `ok` in fetcher.data)

  // The dismissed row takes focus with it
  useEffect(() => {
    if (isDismissed) {
      list.current?.focus()
    }
  }, [isDismissed])

  return (
    <section
      ref={list}
      aria-label='Reports'
      tabIndex={-1}
      className='max-w-3xl outline-none'
    >
      <p className='sr-only' aria-live='polite'>
        {isDismissed ? `Dismissed the report` : ``}
      </p>
      {reports.length === 0 ? (
        <p className='text-muted'>No reports.</p>
      ) : (
        <ul className='border-t-2 border-ink'>
          {reports.map(report => (
            <li
              key={report.id}
              className='flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-muted-light py-2'
            >
              <ReportDescription report={report} />
              <div className='flex flex-wrap items-center gap-4'>
                <Link to={toLink(report).to} className='print:hidden'>
                  {toLink(report).label}
                </Link>
                <fetcher.Form method='post' action={dismissPath}>
                  <input type='hidden' name='id' value={report.id} />
                  <Button
                    type='submit'
                    variant='quiet'
                    aria-label={`Dismiss the report about ${readSubject(report)}: ${REASON_LABELS[report.reason]}`}
                    isPending={fetcher.formData?.get(`id`) === report.id}
                  >
                    Dismiss
                  </Button>
                </fetcher.Form>
              </div>
            </li>
          ))}
        </ul>
      )}
      <FetcherError fetcher={fetcher} />
    </section>
  )
}

const ReportDescription = ({ report }: { report: ReportItem }) => {
  const { player, contest, educatorName, reason, createdAt } = report
  return (
    <div className='min-w-0'>
      <p className='font-semibold wrap-anywhere'>{readSubject(report)}</p>
      <p className='wrap-anywhere text-muted'>
        {[
          REASON_LABELS[reason],
          player ? contest.name : CONTEST_TARGET.label,
          educatorName ?? `No educator`,
        ].join(` · `)}
        {` · `}
        <LocalTime date={createdAt} format={formatDate} />
      </p>
    </div>
  )
}

const readSubject = ({ player, contest }: ReportItem): string =>
  player?.displayName ?? contest.name
