import { useFetcher } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { renderRoutes } from '../../test/render-routes.tsx'
import { Button } from './button.tsx'
import { useIsLatestAction } from './use-is-latest-action.ts'

const SLOW_RENDER_MS = 60

/** React skips the renders that show an action under way when renders are slow */
const SlowToRender = () => {
  const start = performance.now()
  while (performance.now() - start < SLOW_RENDER_MS) {
    // Busy
  }
  return null
}

const Page = () => {
  const save = useFetcher<{ ok: true }>()
  const other = useFetcher<{ ok: true }>()
  const isLatest = useIsLatestAction(save)
  const submit = (fetcher: typeof save) =>
    void fetcher.submit({}, { method: `post`, action: `/act` })
  return (
    <>
      <SlowToRender />
      <SlowToRender />
      <SlowToRender />
      <SlowToRender />
      <Button onPress={() => submit(save)}>Save</Button>
      <Button onPress={() => submit(other)}>Other</Button>
      {save.data && isLatest ? <p>Saved it</p> : null}
      {other.state === `idle` && other.data ? <p>Did the other</p> : null}
    </>
  )
}

test(`an action too fast to show under way still replaces an earlier one's notice`, async () => {
  await renderRoutes([
    {
      path: `/`,
      loader: () => ({}),
      HydrateFallback: () => null,
      Component: Page,
    },
    { path: `/act`, action: () => ({ ok: true }) },
  ])
  await page.getByRole(`button`, { name: `Save` }).click()
  await expect.element(page.getByText(`Saved it`)).toBeVisible()

  await page.getByRole(`button`, { name: `Other` }).click()

  await expect.element(page.getByText(`Did the other`)).toBeVisible()
  await expect.element(page.getByText(`Saved it`)).not.toBeInTheDocument()
})
