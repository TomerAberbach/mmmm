import { createRoutesStub, redirect, useLoaderData } from 'react-router'
import { expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { BRACKET_2025 } from '../../prisma/brackets.ts'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { pickEveryBattle } from '../../test/picks.ts'
import { formatDateTime } from '../dates.ts'
import { listContenders, pickWinner } from '../picks.ts'
import type { Picks } from '../picks.ts'
import type { Submission } from '../player-picks.server.ts'
import { toSeededBracket } from '../seeded-bracket.ts'
import { PlayerBracket } from './player-bracket.tsx'
import type { Submitted } from './player-bracket.tsx'

const BRACKET = toSeededBracket(BRACKET_2025)
const [SEED_1 = ``, SEED_16 = ``] = listContenders(BRACKET, {
  round: `ROUND_1`,
  index: 0,
})
const COMPLETE_PICKS = pickEveryBattle(BRACKET)
// The complete picks with a different champion from Round 1 on
const COMPLETE_CHANGED_PICKS = pickWinner(
  BRACKET,
  pickWinner(BRACKET, COMPLETE_PICKS, { round: `ROUND_1`, index: 0 }, SEED_16)
    .picks,
  { round: `CHAMPIONSHIP`, index: 0 },
  SEED_16,
).picks
const PERSONAL_LINK = `https://mmmm.test/my-bracket/secret`
const SUBMISSION: Submission = {
  status: `PENDING`,
  picksChangedAt: new Date(`2026-03-10T21:41:00Z`),
  picks: COMPLETE_PICKS,
}

// The picker sends its requests through `fetch`, which each test answers
const answerRequests = (
  response: Response | Error,
  onRequest: () => void = () => {},
) =>
  vi.spyOn(globalThis, `fetch`).mockImplementation(async () => {
    onRequest()
    return response instanceof Error
      ? Promise.reject(response)
      : response.clone()
  })

// Stands in for the server recording a submission
const recordSubmission = (server: Server, submission: Submission): void => {
  server.submitted = { submission, personalLink: PERSONAL_LINK }
}

const readSentBodies = (
  fetchSpy: ReturnType<typeof answerRequests>,
): unknown[] =>
  fetchSpy.mock.calls.map(([, init]): unknown =>
    JSON.parse(typeof init?.body === `string` ? init.body : ``),
  )

// What the page's loader returns. A test changes it to stand in for the server
type Server = { draft: Picks; submitted: Submitted | null }

const renderBracket = async ({
  draft = {},
  submission = null,
}: { draft?: Picks; submission?: Submission | null } = {}) => {
  await page.viewport(390, 844)
  const server: Server = {
    draft,
    submitted: submission && { submission, personalLink: PERSONAL_LINK },
  }
  const forgotten: unknown[] = []
  const Stub = createRoutesStub([
    {
      path: `/`,
      loader: () => ({ ...server }),
      Component: () => {
        const data = useLoaderData<Server>()
        return (
          <PlayerBracket
            year={2025}
            input={BRACKET_2025}
            initialDraft={data.draft}
            submitted={data.submitted}
            picksPath='/play/contest/bracket/picks'
            forgetPath='/forgotten'
          />
        )
      },
    },
    {
      path: `/forgotten`,
      action: () => {
        forgotten.push(true)
        return redirect(`/forgotten`)
      },
      Component: () => <p>Forgotten</p>,
    },
  ])
  await render(<Stub />)
  return { server, forgotten }
}

const firstBattle = () =>
  page.getByRole(`radiogroup`, { name: `Round 1, battle 1` })

test(`picking a winner saves the picks and counts them`, async () => {
  const fetchSpy = answerRequests(Response.json({ ok: true }))
  await renderBracket()

  await firstBattle().getByText(SEED_1).click()

  await expect.element(page.getByText(/^Saved at/u)).toBeVisible()
  await expect.element(page.getByText(`1 of 64 picked`)).toBeVisible()
  expect(readSentBodies(fetchSpy)).toStrictEqual([
    { intent: `save`, picks: { 'ROUND_1:0': SEED_1 } },
  ])
})

test(`a save that fails keeps the picks and offers to try again`, async () => {
  answerRequests(new TypeError(`Failed to fetch`))
  await renderBracket()

  await firstBattle().getByText(SEED_1).click()

  await expect
    .element(
      page.getByText(`Couldn’t save. Your picks are still here`, {
        exact: false,
      }),
    )
    .toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Try again` }))
    .toBeVisible()
  await expect.element(page.getByText(`1 of 64 picked`)).toBeVisible()
})

test(`picking who fills an undecided side also picks their earlier wins`, async () => {
  answerRequests(Response.json({ ok: true }))
  await renderBracket()
  await page.getByRole(`tab`, { name: /^Sweet 16/u }).click()

  await page
    .getByRole(`button`, { name: `Pick who wins Round 2, battle 1` })
    .click()
  await page.getByRole(`menuitem`, { name: SEED_16 }).click()

  await expect.element(page.getByText(`2 of 64 picked`)).toBeVisible()
})

test(`a save the server refuses asks for a reload instead of a retry`, async () => {
  answerRequests(Response.json({ error: `` }, { status: 400 }))
  await renderBracket()

  await firstBattle().getByText(SEED_1).click()

  await expect
    .element(page.getByText(`Couldn’t save. Reload the page to keep picking`))
    .toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Try again` }))
    .not.toBeInTheDocument()
})

test(`changing a pick says which later picks it cleared`, async () => {
  answerRequests(Response.json({ ok: true }))
  await renderBracket()
  await firstBattle().getByText(SEED_1).click()
  await page.getByRole(`tab`, { name: /^Round 2/u }).click()
  await page
    .getByRole(`radiogroup`, { name: `Round 2, battle 1` })
    .getByText(SEED_1)
    .click()
  await page.getByRole(`tab`, { name: /^Round 1/u }).click()

  await firstBattle().getByText(SEED_16).click()

  await expect
    .element(
      page.getByText(
        `Your change cleared 1 later pick that depended on it: Round 2, battle 1.`,
      ),
    )
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`submitting with battles left says how many and shows the next one`, async () => {
  const fetchSpy = answerRequests(Response.json({ ok: true }))
  await renderBracket()

  await page.getByRole(`button`, { name: `Submit bracket` }).click()

  await expect
    .element(page.getByRole(`alert`))
    .toHaveTextContent(
      `Pick the last 64 battles to submit. Next up: Wild card.`,
    )
  await expect
    .element(page.getByRole(`tab`, { name: /^Wild card/u }))
    .toHaveAttribute(`aria-selected`, `true`)
  expect(fetchSpy).not.toHaveBeenCalled()
})

test(`submitting every pick shows the personal link and how to keep it`, async () => {
  const { server } = await renderBracket({ draft: COMPLETE_PICKS })
  const fetchSpy = answerRequests(Response.json({ ok: true }), () =>
    recordSubmission(server, SUBMISSION),
  )

  await page.getByRole(`button`, { name: `Submit bracket` }).click()

  await expect
    .element(page.getByRole(`heading`, { name: `Bracket submitted` }))
    .toHaveFocus()
  await expect.element(page.getByText(PERSONAL_LINK)).toBeVisible()
  await expect
    .element(page.getByText(`Submitted · waiting for approval`))
    .toBeVisible()
  expect(readSentBodies(fetchSpy)).toStrictEqual([
    { intent: `submit`, picks: COMPLETE_PICKS },
  ])
  await expectNoAxeViolations()
})

test(`a failed submit stays shown after a later pick saves`, async () => {
  await renderBracket({ draft: COMPLETE_PICKS })
  vi.spyOn(globalThis, `fetch`)
    .mockRejectedValueOnce(new TypeError(`Failed to fetch`))
    .mockResolvedValue(Response.json({ ok: true }))
  await page.getByRole(`button`, { name: `Submit bracket` }).click()
  await expect
    .element(page.getByText(`Couldn’t submit`, { exact: false }))
    .toBeVisible()

  await page.getByRole(`tab`, { name: /^Round 1/u }).click()
  await firstBattle().getByText(SEED_16).click()

  await expect
    .element(page.getByText(`Couldn’t submit`, { exact: false }))
    .toBeVisible()
})

test(`a submitted bracket shows when its picks last changed and its personal link`, async () => {
  await renderBracket({ draft: COMPLETE_PICKS, submission: SUBMISSION })

  await page.getByRole(`button`, { name: `Show my personal link` }).click()

  await expect
    .element(page.getByRole(`dialog`).getByText(PERSONAL_LINK))
    .toBeVisible()
  await expect
    .element(page.getByText(`Submitted picks last changed`, { exact: false }))
    .toHaveTextContent(
      `Submitted picks last changed ${formatDateTime(SUBMISSION.picksChangedAt)}. If you didn’t make a change, tell your educator.`,
    )
})

test(`changing a submitted bracket offers to submit or discard the changes`, async () => {
  answerRequests(Response.json({ ok: true }))
  await renderBracket({ draft: COMPLETE_PICKS, submission: SUBMISSION })
  await page.getByRole(`tab`, { name: /^Round 1/u }).click()

  await firstBattle().getByText(SEED_16).click()

  await expect.element(page.getByText(`Changes not submitted`)).toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Submit changes` }))
    .toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Discard changes` }))
    .toBeVisible()
})

test(`submitting changes to an approved bracket says it stays approved`, async () => {
  const approved: Submission = { ...SUBMISSION, status: `APPROVED` }
  const { server } = await renderBracket({
    draft: COMPLETE_CHANGED_PICKS,
    submission: approved,
  })
  answerRequests(Response.json({ ok: true }), () =>
    recordSubmission(server, {
      ...approved,
      picks: COMPLETE_CHANGED_PICKS,
      picksChangedAt: new Date(`2026-03-11T21:41:00Z`),
    }),
  )

  await page.getByRole(`button`, { name: `Submit changes` }).click()

  await expect
    .element(page.getByRole(`heading`, { name: `Changes submitted` }))
    .toHaveFocus()
  await expect
    .element(
      page.getByText(
        `Your educator approved your bracket, and it stays approved.`,
        { exact: false },
      ),
    )
    .toBeVisible()
})

test(`discarding changes brings back the submitted picks`, async () => {
  const changedPicks = pickWinner(
    BRACKET,
    COMPLETE_PICKS,
    { round: `ROUND_1`, index: 0 },
    SEED_16,
  ).picks
  const fetchSpy = answerRequests(Response.json({ ok: true }))
  await renderBracket({ draft: changedPicks, submission: SUBMISSION })

  await page.getByRole(`button`, { name: `Discard changes` }).click()
  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: `Discard changes` })
    .click()

  await expect
    .element(page.getByText(`Submitted · waiting for approval`))
    .toBeVisible()
  expect(readSentBodies(fetchSpy)).toStrictEqual([{ intent: `discard` }])
})

test(`forgetting this computer asks first, then forgets`, async () => {
  const { forgotten } = await renderBracket({
    draft: COMPLETE_PICKS,
    submission: SUBMISSION,
  })

  await page.getByRole(`button`, { name: `Done, forget this computer` }).click()
  await page.getByRole(`button`, { name: `Forget this computer` }).click()

  await expect.element(page.getByText(`Forgotten`)).toBeVisible()
  expect(forgotten).toStrictEqual([true])
})

test(`the picker passes accessibility checks`, async () => {
  answerRequests(Response.json({ ok: true }))
  await renderBracket()

  await expect.element(firstBattle()).toBeVisible()
  await expectNoAxeViolations()
})
