import { serverFreeTextSchema } from './free-text.server.ts'
import { DISPLAY_NAME } from './free-text.ts'
import { displayNameSchema } from './player-forms.ts'

// Adds the offensive word filter, which the browser bundle leaves out
export const serverDisplayNameSchema = displayNameSchema.extend({
  displayName: serverFreeTextSchema(DISPLAY_NAME),
})
