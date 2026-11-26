import { parseWithZod } from '@conform-to/zod/v4'
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
    return rejectForm(submission)
  }
  const seenVersion = formData.get(`seenVersion`)
  return year !== null &&
    formData.get(`year`) === String(year) &&
    typeof seenVersion === `string` &&
    (await saveUnpublishedBracket(
      year,
      toBracketInput(submission.value),
      seenVersion,
    ))
    ? redirect(href(`/admin`))
    : rejectForm(submission, {
        formErrors: [
          `This bracket changed or moved since the page loaded, so nothing was saved. Reload the page`,
        ],
      })
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
      { result: submission.reply({ formErrors: [message] }) },
      { status: 401 },
    )
  }
}

const AdminBracket = ({ loaderData, actionData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <PageTitle>{`${loaderData.year} bracket`}</PageTitle>
    {/* A bracket can be published once it's saved */}
    {loaderData.summary ? (
      <PhaseSection
        year={loaderData.year}
        archivedYear={loaderData.archivedYear}
        summary={loaderData.summary}
      />
    ) : null}
    <BracketSetupForm
      year={loaderData.year}
      laterYear={loaderData.laterYear}
      version={loaderData.version}
      defaultValue={loaderData.defaultValue}
      lastResult={actionData?.result}
    />
  </div>
)
export default AdminBracket
