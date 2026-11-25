import { z } from 'zod'

/** The IDs as the form field that `idsSchema` reads holds them */
export const joinIds = (rows: { id: string }[]): string =>
  rows.map(({ id }) => id).join(`,`)

/** The rows the educator saw and chose */
export const idsSchema = z.object({
  ids: z.string().transform(ids => ids.split(`,`).filter(id => id !== ``)),
})
