import { z } from 'zod'
import { freeTextSchema, ORGANIZATION_NAME } from './free-text.ts'
import type { FreeTextSchema } from './free-text.ts'

export const organizationNameSchema = (
  text: FreeTextSchema,
): z.ZodObject<{ name: z.ZodString }> =>
  z.object({ name: text(ORGANIZATION_NAME) })

/** The admin's, so it skips the offensive word filter */
export const organizationRenameSchema: z.ZodObject<{
  domain: z.ZodString
  name: z.ZodString
}> = organizationNameSchema(freeTextSchema).extend({ domain: z.string() })
