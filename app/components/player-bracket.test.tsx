import { expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { BRACKET_2025 } from '../../prisma/brackets.ts'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { listContenders, toPickBracket } from '../picks.ts'
import { PlayerBracket } from './player-bracket.tsx'

const BRACKET = toPickBracket(BRACKET_2025)
const [SEED_1 = ``, SEED_16 = ``] = listContenders(BRACKET, {
  round: `ROUND_1`,
  index: 0,
})

// Picks go to the server through `fetch`, which each test answers
const answerSaves = (response: Response | Error) =>
  vi
    .spyOn(globalThis, `fetch`)
    .mockImplementation(async () =>
      response instanceof Error ? Promise.reject(response) : response.clone(),
    )

const renderBracket = async () => {
  await page.viewport(390, 844)
  await render(
    <PlayerBracket
      year={2025}
      input={BRACKET_2025}
      initialPicks={{}}
      savePath='/play/secret/bracket/picks'
    />,
  )
}

const firstBattle = () =>
  page.getByRole(`radiogroup`, { name: `Round 1, battle 1` })

test(`picking a winner saves the picks and counts them`, async () => {
  const fetchSpy = answerSaves(Response.json({ ok: true }))
  await renderBracket()

  await firstBattle().getByText(SEED_1).click()

  await expect.element(page.getByText(/^Saved at/u)).toBeVisible()
  await expect.element(page.getByText(`1 of 64 picked`)).toBeVisible()
  const body = fetchSpy.mock.lastCall?.[1]?.body
  expect(JSON.parse(typeof body === `string` ? body : ``)).toStrictEqual({
    picks: { 'ROUND_1:0': SEED_1 },
  })
})

test(`a save that fails keeps the picks and offers to try again`, async () => {
  answerSaves(new TypeError(`Failed to fetch`))
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
  answerSaves(Response.json({ ok: true }))
  await renderBracket()
  await page.getByRole(`tab`, { name: /^Sweet 16/u }).click()

  await page
    .getByRole(`button`, { name: `Pick who wins Round 2, battle 1` })
    .click()
  await page.getByRole(`menuitem`, { name: SEED_16 }).click()

  await expect.element(page.getByText(`2 of 64 picked`)).toBeVisible()
})

test(`a save the server refuses asks for a reload instead of a retry`, async () => {
  answerSaves(Response.json({ error: `` }, { status: 400 }))
  await renderBracket()

  await firstBattle().getByText(SEED_1).click()

  await expect
    .element(
      page.getByText(
        `Couldn’t save your latest picks. Reload the page to keep picking`,
      ),
    )
    .toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Try again` }))
    .not.toBeInTheDocument()
})

test(`changing a pick says which later picks it cleared`, async () => {
  answerSaves(Response.json({ ok: true }))
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

test(`the picker passes accessibility checks`, async () => {
  answerSaves(Response.json({ ok: true }))
  await renderBracket()

  await expect.element(firstBattle()).toBeVisible()
  await expectNoAxeViolations()
})
