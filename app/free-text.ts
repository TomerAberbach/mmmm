import { z } from 'zod'

export type FreeTextField = {
  // How error messages name the field, such as "your full name"
  label: string
  maxLength: number
}

export const EDUCATOR_NAME: FreeTextField = {
  label: `your full name`,
  maxLength: 80,
}

export const DIVISION_NAME: FreeTextField = {
  label: `each division's name`,
  maxLength: 80,
}

export const COMBATANT_NAME: FreeTextField = {
  label: `each combatant's name`,
  maxLength: 80,
}

// The checks the browser can run too. The server adds the offensive word
// filter
export const freeTextSchema = ({
  label,
  maxLength,
}: FreeTextField): z.ZodString =>
  z
    .string({ error: `Enter ${label}` })
    .trim()
    .min(1, `Enter ${label}`)
    .max(maxLength, `Shorten ${label} to ${maxLength} characters or fewer`)
