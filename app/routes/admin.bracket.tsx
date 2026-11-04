import { parseWithZod } from '@conform-to/zod/v4'
import { redirect } from 'react-router'
import type { Route } from './+types/admin.bracket.ts'
import {
  bracketFormSchema,
  toBracketForm,
  toBracketInput,
} from '~/bracket-form.ts'
import {
  readBracket,
  readBracketCombatants,
  readBracketSummary,
  saveUnpublishedBracket,
} from '~/brackets.server.ts'
import { BracketSetupForm } from '~/components/bracket-setup-form.tsx'
import { CombatantRenames } from '~/components/combatant-renames.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { PhaseSection } from '~/components/phase-section.tsx'
import { rejectSubmission } from '~/form-replies.server.ts'
import { readUpcomingYear } from '~/year.ts'

// Only the upcoming year's bracket can be managed here. Until it's published,
// the setup form edits it. After that, only its combatants' names change
export const loader = async () => {
  const year = readUpcomingYear(new Date())
  const summary = await readBracketSummary(year)
  if (summary?.phase === `OPEN`) {
    return {
      editor: `renames` as const,
      year,
      summary,
      divisions: await readBracketCombatants(year),
    }
  }
  const input = summary && (await readBracket(year))
  return {
    editor: `setup` as const,
    year,
    summary,
    defaultValue: input ? toBracketForm(input) : undefined,
  }
}

export const action = async ({ request }: Route.ActionArgs) => {
  const year = readUpcomingYear(new Date())
  const submission = parseWithZod(await request.formData(), {
    schema: bracketFormSchema,
  })
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
    {loaderData.summary ? (
      <PhaseSection year={loaderData.year} summary={loaderData.summary} />
    ) : null}
    {loaderData.editor === `renames` ? (
      <CombatantRenames divisions={loaderData.divisions} />
    ) : (
      <BracketSetupForm
        year={loaderData.year}
        defaultValue={loaderData.defaultValue}
        lastResult={actionData?.result}
      />
    )}
  </div>
)
export default AdminBracket
