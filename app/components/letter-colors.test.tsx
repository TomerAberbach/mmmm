import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { LetterColors } from './letter-colors.tsx'

test(`colored text reads as one word to screen readers`, async () => {
  await render(
    <h1>
      <LetterColors text='Your contests' />
    </h1>,
  )

  await expect
    .element(page.getByRole(`heading`, { name: `Your contests` }))
    .toBeVisible()
  await expectNoAxeViolations()
})
