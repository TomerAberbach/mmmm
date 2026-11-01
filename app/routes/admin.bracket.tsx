import { parseWithZod } from '@conform-to/zod/v4'
import { redirect } from 'react-router'
import type { Route } from './+types/admin.bracket.ts'
import {
  bracketFormSchema,
  toBracketForm,
  toBracketInput,
} from '~/bracket-form.ts'
import {
  deleteUnpublishedBracket,
  readBracket,
  readBracketCombatants,
  readBracketSummary,
  saveUnpublishedBracket,
} from '~/brackets.server.ts'
import type { BracketSummary } from '~/brackets.server.ts'
import { BracketSetupForm } from '~/components/bracket-setup-form.tsx'
import { CombatantRenames } from '~/components/combatant-renames.tsx'
import type { ConfirmResult } from '~/components/confirm-dialog.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import type { PhaseView } from '~/components/phase-section.tsx'
import { PhaseSection } from '~/components/phase-section.tsx'
import { formatArizonaDate, toIsoDate } from '~/dates.ts'
import { rejectSubmission } from '~/reject-submission.server.ts'
import { readUpcomingYear } from '~/year.ts'

// Only the upcoming year's bracket can be managed here. Until it's published,
// the setup form edits it. After that, only its combatants' names change
export const loader = async () => {
  const year = readUpcomingYear(new Date())
  const summary = await readBracketSummary(year)
  const phaseView = summary && toPhaseView(summary)
  if (summary?.phase === `OPEN`) {
    return {
      editor: `renames` as const,
      year,
      phaseView,
      divisions: await readBracketCombatants(year),
    }
  }
  const bracket = summary && (await readBracket(year))
  return {
    editor: `setup` as const,
    year,
    phaseView,
    defaultValue: bracket ? toBracketForm(bracket.input) : undefined,
  }
}

const toPhaseView = (summary: BracketSummary): PhaseView => {
  const expectedLockDate =
    summary.expectedLockDate && toIsoDate(summary.expectedLockDate)
  return summary.phase === `OPEN`
    ? {
        phase: summary.phase,
        publishedOn: formatArizonaDate(summary.publishedAt),
        expectedLockDate,
      }
    : { phase: summary.phase, expectedLockDate }
}

export const action = async ({ request }: Route.ActionArgs) => {
  const year = readUpcomingYear(new Date())
  const formData = await request.formData()
  if (formData.get(`intent`) === `delete`) {
    return (await deleteUnpublishedBracket(year))
      ? redirect(`/admin`)
      : ({
          error: `The ${year} bracket is already published or deleted`,
        } satisfies ConfirmResult)
  }

  const submission = parseWithZod(formData, { schema: bracketFormSchema })
  if (submission.status !== `success`) {
    return rejectSubmission(submission)
  }
  return (await saveUnpublishedBracket(year, toBracketInput(submission.value)))
    ? redirect(`/admin`)
    : rejectSubmission(submission, {
        formErrors: [
          `The ${year} bracket is published, so it can't change here`,
        ],
      })
}

const AdminBracket = ({ loaderData, actionData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <PageTitle>{`${loaderData.year} bracket`}</PageTitle>
    {/* A bracket can be published once it's saved */}
    {loaderData.phaseView ? (
      <PhaseSection year={loaderData.year} view={loaderData.phaseView} />
    ) : null}
    {loaderData.editor === `renames` ? (
      <CombatantRenames divisions={loaderData.divisions} />
    ) : (
      <BracketSetupForm
        year={loaderData.year}
        defaultValue={loaderData.defaultValue}
        lastResult={
          actionData && `result` in actionData ? actionData.result : undefined
        }
      />
    )}
  </div>
)
export default AdminBracket
