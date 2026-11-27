import { useLoaderData } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { BRACKET_2026 } from '../../prisma/brackets.ts'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { storeTestBracket } from '../../test/picks.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { moveRequestSchema } from '../move-request.ts'
import type { MoveReply } from '../moves.server.ts'
import { swapCombatants } from '../moves.ts'
import type { StoredBracket } from '../seeded-bracket.ts'
import { CombatantMoves } from './combatant-moves.tsx'

const BRACKET = storeTestBracket(BRACKET_2026)
const [SEED_1, SEED_2, SEED_3] = BRACKET.divisions.TOP_LEFT.combatants

const IMPACT = {
  battles: 9,
  submissions: 214,
  drafts: 1,
  results: [`ROUND_1:0`, `ROUND_1:7`, `ROUND_2:0`],
}

/** Renders the section with an action that moves combatants in memory */
const renderMoves = async ({
  isLocked = false,
  reply = { impact: IMPACT },
  reload = Promise.resolve(),
}: {
  isLocked?: boolean
  reply?: MoveReply
  /** What loading the page waits for once a move is saved */
  reload?: Promise<void>
} = {}) => {
  let bracket = BRACKET
  let reloaded = Promise.resolve()
  await renderRoutes([
    {
      path: `/`,
      loader: async () => {
        await reloaded
        return bracket
      },
      HydrateFallback: () => null,
      Component: () => (
        <CombatantMoves
          year={2026}
          bracket={useLoaderData<StoredBracket>()}
          isLocked={isLocked}
        />
      ),
    },
    {
      path: `/admin/bracket/move`,
      action: async ({ request }): Promise<MoveReply> => {
        const move = moveRequestSchema.parse(await request.json())
        if (move.intent === `preview`) {
          return reply
        }
        bracket = swapCombatants(bracket, move.swaps)!
        reloaded = reload
        return { ok: true }
      },
    },
  ])
}

const choose = async (label: string, name: string) => {
  await page.getByRole(`button`, { name: new RegExp(`${label}$`, `u`) }).click()
  await page
    .getByRole(`option`, { name: new RegExp(`: ${name}$`, `u`) })
    .click()
}

const addSwap = async (first: string, second: string) => {
  await choose(`Swap`, first)
  await choose(`With`, second)
  await page.getByRole(`button`, { name: `Add swap` }).click()
}

test(`a move is confirmed with what it clears`, async () => {
  await renderMoves()
  await addSwap(SEED_1!.name, SEED_2!.name)
  await page.getByRole(`button`, { name: `Review 1 swap` }).click()
  const dialog = page.getByRole(`alertdialog`)
  await expect
    .element(
      dialog.getByText(
        `214 submissions return to drafts, and 1 draft loses picks.`,
        {
          exact: false,
        },
      ),
    )
    .toBeVisible()
  await expectNoAxeViolations()

  await dialog.getByRole(`button`, { name: `Move combatants` }).click()

  await expect.element(page.getByText(`Moved the combatants`)).toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: /^Review/u }))
    .not.toBeInTheDocument()
})

test(`once locked, the dialog says that cleared picks score nothing`, async () => {
  await renderMoves({ isLocked: true })
  await addSwap(SEED_1!.name, SEED_2!.name)

  await page.getByRole(`button`, { name: `Review 1 swap` }).click()

  await expect
    .element(page.getByText(`score nothing`, { exact: false }))
    .toBeVisible()
  await expect
    .element(page.getByText(`It also clears 3 results, to record again.`))
    .toBeVisible()
})

test.each([
  [
    `no draft`,
    { submissions: 1, drafts: 0 },
    `1 submission returns to a draft. Those players see a note to finish and submit.`,
  ],
  [
    `no submission`,
    { submissions: 0, drafts: 2 },
    `2 drafts lose picks. Those players see a note to finish and submit.`,
  ],
])(`a move that affects %s leaves it out`, async (_, counts, effect) => {
  await renderMoves({ reply: { impact: { ...IMPACT, ...counts } } })
  await addSwap(SEED_1!.name, SEED_2!.name)

  await page.getByRole(`button`, { name: `Review 1 swap` }).click()

  await expect.element(page.getByText(effect, { exact: true })).toBeVisible()
})

test.each([
  [`open`, false],
  [`locked`, true],
])(
  `a move that no counted player picked still can't be undone while %s`,
  async (_, isLocked) => {
    await renderMoves({
      isLocked,
      reply: { impact: { ...IMPACT, submissions: 0, drafts: 0, results: [] } },
    })
    await addSwap(SEED_1!.name, SEED_2!.name)

    await page.getByRole(`button`, { name: `Review 1 swap` }).click()

    await expect
      .element(page.getByText(`Moving them back won’t restore what’s cleared.`))
      .toBeVisible()
    await expect
      .element(page.getByText(/score nothing|submission|No player/u))
      .not.toBeInTheDocument()
  },
)

test(`a swap can be removed before the review`, async () => {
  await renderMoves()
  await addSwap(SEED_1!.name, SEED_2!.name)
  await addSwap(SEED_1!.name, SEED_3!.name)

  await page
    .getByRole(`button`, {
      name: `Remove the swap of ${SEED_1!.name} and ${SEED_2!.name}`,
    })
    .click()

  await expect
    .element(page.getByRole(`button`, { name: `Review 1 swap` }))
    .toBeVisible()
})

test(`a refused preview says so`, async () => {
  await renderMoves({
    reply: {
      error: `This bracket changed since the page loaded. Reload the page`,
    },
  })
  await addSwap(SEED_1!.name, SEED_2!.name)

  await page.getByRole(`button`, { name: `Review 1 swap` }).click()

  await expect
    .element(
      page.getByText(
        `This bracket changed since the page loaded. Reload the page`,
      ),
    )
    .toBeVisible()
})

test(`swaps that cancel out leave the list once saved`, async () => {
  await renderMoves()
  await addSwap(SEED_1!.name, SEED_2!.name)
  await addSwap(SEED_1!.name, SEED_2!.name)
  await page.getByRole(`button`, { name: `Review 2 swaps` }).click()
  const dialog = page.getByRole(`alertdialog`)
  await expect
    .element(dialog.getByText(`The swaps cancel out, so no combatant moves.`))
    .toBeVisible()

  await dialog.getByRole(`button`, { name: `Move combatants` }).click()

  await expect
    .element(page.getByText(`The swaps canceled out, so no combatant moved`))
    .toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: /^Review/u }))
    .not.toBeInTheDocument()
})

test(`a swap added before the page reloads stays once swaps that cancel out are saved`, async () => {
  const { promise: reload, resolve: finishReload } =
    Promise.withResolvers<undefined>()
  await renderMoves({ reload })
  await addSwap(SEED_1!.name, SEED_2!.name)
  await addSwap(SEED_1!.name, SEED_2!.name)
  await page.getByRole(`button`, { name: `Review 2 swaps` }).click()
  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: `Move combatants` })
    .click()
  await expect
    .element(page.getByText(`The swaps canceled out, so no combatant moved`))
    .toBeVisible()

  await addSwap(SEED_1!.name, SEED_3!.name)
  finishReload(undefined)

  await expect
    .element(page.getByRole(`button`, { name: `Review 1 swap` }))
    .toBeVisible()
})
