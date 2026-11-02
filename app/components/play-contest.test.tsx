import type { SubmissionResult } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { createRoutesStub, useActionData } from 'react-router'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { displayNameSchema } from '../player-forms.ts'
import { ContestContext, PlayContestPage } from './play-contest.tsx'
import type { PlayView } from './play-contest.tsx'

const CONTEST = {
  name: `Period 6 Biology`,
  yearId: 2027,
  educatorName: `Ms. Rivera`,
}

// The action refuses every name with `error`
const renderPlay = async (view: PlayView, error = ``) => {
  const Stub = createRoutesStub([
    {
      path: `/play/secret`,
      action: async ({ request }) => {
        const submission = parseWithZod(await request.formData(), {
          schema: displayNameSchema,
        })
        return {
          result: submission.reply({ fieldErrors: { displayName: [error] } }),
        }
      },
      Component: () => (
        <PlayContestPage
          view={view}
          lastResult={
            useActionData<{ result: SubmissionResult } | undefined>()?.result
          }
        />
      ),
    },
  ])
  await render(<Stub initialEntries={[`/play/secret`]} />)
}

test(`the contest link asks for a first name and last initial`, async () => {
  await renderPlay({ state: `askName` })

  await expect
    .element(
      page.getByRole(`textbox`, {
        name: `What’s your first name and last initial?`,
      }),
    )
    .toHaveAccessibleDescription(
      `For example, Maya R. Your educator sees it, and other players may see it on leaderboards`,
    )
  await expectNoAxeViolations()
})

test(`a refused name shows why under the field`, async () => {
  await renderPlay(
    { state: `askName` },
    `Use a different name. This one has a word MMMM doesn’t allow`,
  )
  await userEvent.fill(
    page.getByRole(`textbox`, {
      name: `What’s your first name and last initial?`,
    }),
    `Maya R.`,
  )

  await page.getByRole(`button`, { name: `Start my bracket` }).click()

  await expect
    .element(
      page.getByText(
        `Use a different name. This one has a word MMMM doesn’t allow`,
      ),
    )
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`a remembered player continues to their bracket`, async () => {
  await renderPlay({
    state: `returning`,
    displayName: `Maya R.`,
    bracketPath: `/play/secret/bracket`,
  })

  const link = page.getByRole(`link`, { name: `Continue as Maya R.` })

  await expect.element(link).toHaveAttribute(`href`, `/play/secret/bracket`)
})

test(`a remembered player is offered a new bracket instead`, async () => {
  await renderPlay({
    state: `returning`,
    displayName: `Maya R.`,
    bracketPath: `/play/secret/bracket`,
  })

  await expect
    .element(page.getByRole(`heading`, { name: `Continue as Maya R.?` }))
    .toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Not you? Start a new bracket` }))
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`a past year's contest takes no new players`, async () => {
  await renderPlay({ state: `closed` })

  await expect
    .element(page.getByRole(`heading`, { name: `New brackets are closed` }))
    .toBeVisible()
  await expect.element(page.getByRole(`textbox`)).not.toBeInTheDocument()
})

test(`the contest link names the contest and its educator`, async () => {
  await render(<ContestContext contest={CONTEST} />)

  await expect
    .element(page.getByText(`Period 6 Biology · Ms. Rivera’s contest`))
    .toBeVisible()
})
