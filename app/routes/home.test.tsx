import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import Home from './home.tsx'

test(`home page shows the app name`, async () => {
  await render(<Home />)

  await expect
    .element(
      page.getByRole(`heading`, { name: `March Mammal Madness Manager` }),
    )
    .toBeVisible()
  await expectNoAxeViolations()
})
