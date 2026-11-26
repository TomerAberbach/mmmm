import type { Submission } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { useState } from 'react'
import { data, href, redirect } from 'react-router'
import type { Route } from './+types/admin.bracket.ts'
import {
  bracketFormSchema,
  toBracketForm,
  toBracketInput,
} from '~/bracket-form.ts'
import { toNames } from '~/bracket-input.ts'
import {
  readAdminYears,
  readBracket,
  readBracketSummary,
  saveUnpublishedBracket,
  toBracketVersion,
} from '~/brackets.server.ts'
import { BracketSetupForm } from '~/components/bracket-setup-form.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { PhaseSection } from '~/components/phase-section.tsx'
import { rejectForm } from '~/form-replies.server.ts'
import { readLostSessionMessage } from '~/lost-session.ts'
import { readUpcomingYear } from '~/year.ts'

/** Only for a year to set up. The current year's bracket is with its results */
export const loader = async () => {
  const { current, setupYear: year } = await readAdminYears()
  if (year === null) {
    return redirect(href(`/admin/results`))
  }
  const upcomingYear = readUpcomingYear(new Date())
  const summary = await readBracketSummary(year)
  const bracket = summary && (await readBracket(year))
  const names = bracket && toNames(bracket)
  return {
    year,
    archivedYear:
      current?.summary.phase === `COMPLETE`
        ? { year: current.year, resultCount: current.summary.resultCount }
        : null,
    summary,
    laterYear: upcomingYear > year ? upcomingYear : null,
    version: toBracketVersion(names),
    defaultValue: names ? toBracketForm(names) : undefined,
  }
}

export const action = async ({ request }: Route.ActionArgs) => {
  const { setupYear: year } = await readAdminYears()
  const formData = await request.formData()
  const submission = parseWithZod(formData, {
    schema: bracketFormSchema,
  })
  if (submission.status !== `success`) {
    return reject(submission)
  }
  // The admin chose to replace the bracket with this version
  const seenVersion =
    formData.get(`replacedVersion`) ?? formData.get(`seenVersion`)
  if (
    year === null ||
    formData.get(`year`) !== String(year) ||
    typeof seenVersion !== `string`
  ) {
    return reject(submission, [CANNOT_CHANGE])
  }
  const saved = await saveUnpublishedBracket(
    year,
    toBracketInput(submission.value),
    seenVersion,
  )
  if (`saved` in saved) {
    return redirect(href(`/admin`))
  }
  return saved.refusal === `STALE`
    ? reject(submission, [STALE], saved.version)
    : reject(submission, [CANNOT_CHANGE])
}

/**
 * Keeps the typed names when the session ran out. The error status stops the
 * loaders from running again, whose redirect would leave the page
 */
export const clientAction = async ({
  request,
  serverAction,
}: Route.ClientActionArgs) => {
  const formData = await request.clone().formData()
  try {
    return await serverAction()
  } catch (error) {
    const message = readLostSessionMessage(error)
    if (message === undefined) {
      throw error
    }
    const submission = parseWithZod(formData, { schema: bracketFormSchema })
    return data(
      {
        result: submission.reply({ formErrors: [message] }),
        newerVersion: null,
      },
      { status: 401 },
    )
  }
}

/** `newerVersion` is of the bracket that the save would have replaced */
const reject = (
  submission: Submission<unknown>,
  formErrors: string[] = [],
  newerVersion: string | null = null,
) => {
  const { data: reply, init } = rejectForm(submission, { formErrors })
  return data({ ...reply, newerVersion }, init ?? undefined)
}

const STALE = `This bracket changed since the page loaded, so nothing was saved. Reload the page to see it, or save these names in its place`

const CANNOT_CHANGE = `This bracket can’t change here now. Reload the page`

const AdminBracket = (props: Route.ComponentProps) => (
  <AdminBracketPage key={props.loaderData.year} {...props} />
)
export default AdminBracket

const AdminBracketPage = ({
  loaderData,
  actionData,
}: Pick<Route.ComponentProps, `loaderData` | `actionData`>) => {
  // The fields keep the bracket they opened with, even once the page reloads its
  // data, so what Save, Publish, and Delete act on does too
  const [version] = useState(loaderData.version)
  return (
    <div className='flex flex-col gap-8'>
      <PageTitle>{`${loaderData.year} bracket`}</PageTitle>
      {/* A bracket can be published once it's saved */}
      {loaderData.summary ? (
        <PhaseSection
          year={loaderData.year}
          archivedYear={loaderData.archivedYear}
          summary={loaderData.summary}
          version={version}
        />
      ) : null}
      <BracketSetupForm
        year={loaderData.year}
        laterYear={loaderData.laterYear}
        version={version}
        newerVersion={actionData?.newerVersion}
        defaultValue={loaderData.defaultValue}
        lastResult={actionData?.result}
      />
    </div>
  )
}
