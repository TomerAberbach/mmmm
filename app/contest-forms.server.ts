import { contestNameSchema } from './contest-forms.ts'
import { serverFreeTextSchema } from './free-text.server.ts'
import { CONTEST_NAME } from './free-text.ts'

// Adds the offensive word filter, which the browser bundle leaves out
export const serverContestNameSchema = contestNameSchema.extend({
  name: serverFreeTextSchema(CONTEST_NAME),
})
