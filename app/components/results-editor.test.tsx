import { useLoaderData } from 'react-router'
import { expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { BRACKET_2026 } from '../../prisma/brackets.ts'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { storeTestBracket } from '../../test/picks.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import type { ResultRequest } from '../result-request.ts'
import type { Results } from '../results.ts'
import { ResultsEditor } from './results-editor.tsx'

const NILE_CROCODILE = `id-Nile Crocodile`
const PAPYRUS = `id-Papyrus`

/** The editor sends its requests through `fetch`, which each test answers */
const renderEditor = async (
  initialResults: Results = {},
  respond = () => Promise.resolve(new Response(null)),
) => {
  await page.viewport(390, 844)
  const fetchSpy = vi.spyOn(globalThis, `fetch`).mockImplementation(respond)
  await renderRoutes([
    {
      path: `/`,
      loader: () => ({
        isLocked:
          Object.keys(initialResults).length > 0 ||
          fetchSpy.mock.calls.length > 0,
      }),
      HydrateFallback: () => null,
      Component: () => (
        <ResultsEditor
          year={2026}
          bracket={storeTestBracket(BRACKET_2026)}
          initialResults={initialResults}
          isLocked={useLoaderData<{ isLocked: boolean }>().isLocked}
        />
      ),
    },
  ])
  await page.getByRole(`tab`, { name: /^Round 1/u }).click()
  return () =>
    fetchSpy.mock.calls.map(
      ([, init]) =>
        JSON.parse(
          typeof init?.body === `string` ? init.body : ``,
        ) as ResultRequest,
    )
}

const firstBattle = () =>
  page.getByRole(`group`, { name: `Round 1, battle 1`, exact: true })

const press = (name: RegExp) =>
  firstBattle().getByRole(`button`, { name }).click()

const confirm = (name: string) =>
  page.getByRole(`alertdialog`).getByRole(`button`, { name }).click()

test(`the first result asks before it locks submissions`, async () => {
  const readRequests = await renderEditor()

  await press(/Nile Crocodile/u)

  await expect
    .element(page.getByRole(`heading`, { name: `Lock submissions?` }))
    .toBeVisible()
  expect(readRequests()).toStrictEqual([])
  await expectNoAxeViolations()
  await confirm(`Save result and lock`)
  await expect.element(page.getByText(/^Saved at/u)).toBeVisible()
  expect(readRequests()).toMatchObject([
    {
      battle: { round: `ROUND_1`, index: 0 },
      winnerId: NILE_CROCODILE,
      previousWinnerId: null,
      locks: true,
    },
  ])
})

test(`canceling the first result saves nothing`, async () => {
  const readRequests = await renderEditor()
  await press(/Nile Crocodile/u)

  await confirm(`Cancel`)

  await expect.element(page.getByText(`0 of 64 results`)).toBeVisible()
  expect(readRequests()).toStrictEqual([])
})

test(`a later result saves without asking`, async () => {
  const readRequests = await renderEditor({ 'ROUND_1:1': `id-Mouse` })

  await press(/Nile Crocodile/u)

  await expect.element(page.getByText(`2 of 64 results`)).toBeVisible()
  expect(readRequests()).toMatchObject([
    { winnerId: NILE_CROCODILE, locks: false },
  ])
})

test(`changing a result names the later results it clears`, async () => {
  const readRequests = await renderEditor({
    'ROUND_1:0': NILE_CROCODILE,
    'ROUND_2:0': NILE_CROCODILE,
  })

  await press(/Papyrus/u)

  await expect
    .element(page.getByRole(`alertdialog`))
    .toHaveTextContent(
      `Change this result?Round 1, battle 1: Papyrus instead of Nile Crocodile.This also clears 1 later result that depended on it:Round 2, battle 1: Nile CrocodileCancelChange result`,
    )
  await confirm(`Change result`)
  await expect
    .element(page.getByText(`Also cleared 1 later result: Round 2, battle 1.`))
    .toBeVisible()
  expect(readRequests()).toMatchObject([
    {
      winnerId: PAPYRUS,
      previousWinnerId: NILE_CROCODILE,
      cleared: [`ROUND_2:0`],
    },
  ])
})

test(`pressing the recorded winner asks to clear the result`, async () => {
  const readRequests = await renderEditor({ 'ROUND_1:0': NILE_CROCODILE })

  await press(/Nile Crocodile/u)
  await confirm(`Clear result`)

  await expect.element(page.getByText(`0 of 64 results`)).toBeVisible()
  expect(readRequests()).toMatchObject([
    { winnerId: null, previousWinnerId: NILE_CROCODILE },
  ])
})

test(`a failed save offers to try again and holds other results`, async () => {
  const readRequests = await renderEditor({ 'ROUND_1:1': `id-Mouse` }, () =>
    Promise.reject(new TypeError(`Failed to fetch`)),
  )
  await press(/Nile Crocodile/u)
  await expect
    .element(page.getByText(`Couldn’t save the result`, { exact: false }))
    .toBeVisible()

  await press(/Papyrus/u)
  await page.getByRole(`button`, { name: `Try again` }).click()

  await expect.poll(readRequests).toHaveLength(2)
  const [failed, retried] = readRequests()
  expect(retried).toStrictEqual(failed)
})

test(`a refused save asks for a reload`, async () => {
  await renderEditor({ 'ROUND_1:1': `id-Mouse` }, () =>
    Promise.resolve(new Response(null, { status: 409 })),
  )

  await press(/Nile Crocodile/u)

  await expect
    .element(page.getByRole(`alert`))
    .toHaveTextContent(`Couldn’t save the result. Reload the page`)
})

test(`the results editor passes accessibility checks`, async () => {
  await renderEditor({ 'ROUND_1:0': NILE_CROCODILE })

  await expect
    .element(firstBattle().getByRole(`button`, { name: /Nile Crocodile/u }))
    .toHaveAttribute(`aria-pressed`, `true`)
  await expectNoAxeViolations()
})

test(`a merge is recorded under a combined name`, async () => {
  const readRequests = await renderEditor({ 'ROUND_1:1': `id-Mouse` })
  await page.getByRole(`button`, { name: `Record a merge` }).click()
  await page
    .getByRole(`dialog`)
    .getByRole(`button`, { name: /Battle/u })
    .click()
  await page
    .getByRole(`option`, { name: /^Round 1, battle 1: Nile Crocodile/u })
    .click()
  await expectNoAxeViolations()
  await page.getByLabelText(`Combined name`).fill(`Croc & Roll`)

  await page.getByRole(`button`, { name: `Record merge` }).click()

  await expect.element(page.getByText(/^Saved at/u)).toBeVisible()
  expect(readRequests()).toMatchObject([
    {
      battle: { round: `ROUND_1`, index: 0 },
      merge: { name: `Croc & Roll` },
      previousWinnerId: null,
    },
  ])
  await expect
    .element(firstBattle().getByRole(`button`, { pressed: true }).nth(1))
    .toBeVisible()
  await page.getByRole(`tab`, { name: /^Round 2/u }).click()
  await expect
    .element(page.getByRole(`button`, { name: /Croc & Roll/u }))
    .toBeVisible()
})

test(`a merge's name can't be another combatant's`, async () => {
  const readRequests = await renderEditor({ 'ROUND_1:1': `id-Mouse` })
  await page.getByRole(`button`, { name: `Record a merge` }).click()
  await page.getByLabelText(`Combined name`).fill(`papyrus`)

  await page.getByRole(`button`, { name: `Record merge` }).click()

  await expect
    .element(
      page.getByText(
        `papyrus is already a combatant. Give each combatant its own name`,
      ),
    )
    .toBeVisible()
  expect(readRequests()).toStrictEqual([])
})

test(`a cleared merge's name is free again`, async () => {
  await renderEditor({ 'ROUND_1:1': `id-Mouse` })
  const mergeFirst = async () => {
    await page.getByRole(`button`, { name: `Record a merge` }).click()
    await page
      .getByRole(`dialog`)
      .getByRole(`button`, { name: /Battle/u })
      .click()
    await page
      .getByRole(`option`, { name: /^Round 1, battle 1: Nile Crocodile/u })
      .click()
    await page.getByRole(`button`, { name: `Record merge` }).click()
    await expect.element(page.getByRole(`dialog`)).not.toBeInTheDocument()
  }
  await mergeFirst()
  await press(/Papyrus/u)
  await confirm(`Change result`)
  await press(/Papyrus/u)
  await confirm(`Clear result`)

  await mergeFirst()

  await page.getByRole(`tab`, { name: /^Round 2/u }).click()
  await expect
    .element(page.getByRole(`button`, { name: /Nile Crocodile & Papyrus/u }))
    .toBeVisible()
})
