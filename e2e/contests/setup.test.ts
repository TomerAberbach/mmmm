import { test as setup } from '@playwright/test'
import { ADMIN_LIST, signInAsAdmin } from '../admins.ts'
import { setUpAndPublishBracket } from '../brackets.ts'

const CONTEST_ADMIN = ADMIN_LIST[7] ?? ``

// Educators create contests only once the upcoming year's bracket is published
setup(`publish the bracket`, async ({ page }) => {
  await signInAsAdmin(page, CONTEST_ADMIN)
  await setUpAndPublishBracket(page)
})
