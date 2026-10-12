import { nameSchema } from './auth-forms.ts'
import { serverFreeTextSchema } from './free-text.server.ts'
import { EDUCATOR_NAME } from './free-text.ts'

// Adds the offensive word filter, which the browser bundle leaves out
export const serverNameSchema = nameSchema.extend({
  name: serverFreeTextSchema(EDUCATOR_NAME),
})
