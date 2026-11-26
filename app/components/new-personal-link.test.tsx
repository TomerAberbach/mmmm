import { useState } from 'react'
import { expect, test, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { NewPersonalLink } from './new-personal-link.tsx'
import type { ContestPlayer } from '~/contest-players.server.ts'

const LINK = `https://mmmm.onl/my-bracket/new-secret`

const MAYA: ContestPlayer = {
  id: `maya`,
  displayName: `Maya R.`,
  startedAt: new Date(`2027-03-14T16:05:00Z`),
  status: `PENDING`,
  score: 0,
}

const Page = () => {
  const [player, setPlayer] = useState<ContestPlayer | null>(MAYA)
  return (
    <NewPersonalLink
      contestId='period-2'
      player={player}
      onClose={() => setPlayer(null)}
    />
  )
}

/** Opens the confirmation. The server answers with `response` */
const renderNewLink = async (
  response: Response,
  { canCopy = true } = {},
): Promise<{ copied: string[] }> => {
  vi.spyOn(globalThis, `fetch`).mockResolvedValue(response)
  const copied: string[] = []
  // Runs only in the browser, so Node's support doesn't apply
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  vi.spyOn(navigator.clipboard, `writeText`).mockImplementation(text => {
    if (!canCopy) {
      return Promise.reject(new Error(`Not allowed`))
    }
    copied.push(text)
    return Promise.resolve()
  })
  await renderRoutes([{ path: `/`, Component: Page }])
  return { copied }
}

const createLink = () =>
  page.getByRole(`button`, { name: `Create new link` }).click()

test(`replacing a personal link asks first`, async () => {
  await renderNewLink(Response.json({ link: LINK }))

  await expect
    .element(page.getByRole(`alertdialog`))
    .toHaveTextContent(
      `Replace Maya R.’s personal link?The old link stops working, also in any browser that has it open. Give Maya R. the new one, and no one else.CancelCreate new link`,
    )
})

test(`the new link is copied and shown`, async () => {
  const { copied } = await renderNewLink(Response.json({ link: LINK }))

  await createLink()

  await expect.element(page.getByText(LINK)).toBeVisible()
  await expect
    .element(
      page.getByText(`The link is copied. You won’t be able to see it again.`),
    )
    .toBeVisible()
  expect(copied).toStrictEqual([LINK])
  await expectNoAxeViolations()
})

test(`a link the browser can't copy says to copy it`, async () => {
  await renderNewLink(Response.json({ link: LINK }), { canCopy: false })

  await createLink()

  await expect
    .element(
      page.getByText(`Copy the link now. You won’t be able to see it again.`),
    )
    .toBeVisible()
})

test(`closing the new link forgets it`, async () => {
  await renderNewLink(Response.json({ link: LINK }))
  await createLink()

  await page.getByRole(`button`, { name: `Close` }).click()

  await expect.element(page.getByText(LINK)).not.toBeInTheDocument()
})

test(`a refused replacement says the old link may or may not work`, async () => {
  await renderNewLink(new Response(null, { status: 404 }))

  await createLink()

  await expect
    .element(page.getByRole(`dialog`))
    .toHaveTextContent(
      `No new link for Maya R.Something went wrong, so the old link may or may not still work. Reload the page and try again.Close`,
    )
})

test(`the confirmation stays open until the link is created`, async () => {
  const answer = Promise.withResolvers<Response>()
  vi.spyOn(globalThis, `fetch`).mockReturnValue(answer.promise)
  await renderRoutes([{ path: `/`, Component: Page }])
  await createLink()

  // `user-event` writes keys in braces
  // eslint-disable-next-line unicorn/no-incorrect-template-string-interpolation
  await userEvent.keyboard(`{Escape}`)

  await expect.element(page.getByRole(`alertdialog`)).toBeVisible()
  answer.resolve(new Response(null, { status: 404 }))
  await expect.element(page.getByRole(`alertdialog`)).not.toBeInTheDocument()
})
