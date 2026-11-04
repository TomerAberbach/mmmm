import { test as setup } from '@playwright/test'
import { ADMINS, signInAsAdmin } from '../admins.ts'
import { setUpAndPublishBracket } from '../brackets.ts'

// Educators create contests only once the upcoming year's bracket is published
setup(`publish the bracket`, async ({ page }) => {
  await signInAsAdmin(page, ADMINS.contest)
  await setUpAndPublishBracket(page)
})
