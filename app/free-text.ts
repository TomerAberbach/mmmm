import { z } from 'zod'

export type FreeTextField = {
  // How error messages name the field, such as "your full name"
  label: string
  maxLength: number
  offensiveMessage?: string
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

export const CONTEST_NAME: FreeTextField = {
  label: `the contest's name`,
  maxLength: 80,
}

export const DISPLAY_NAME: FreeTextField = {
  label: `your first name and last initial`,
  maxLength: 30,
  // Players are often children, so the refusal names no fault
  offensiveMessage: `Use a different name. This one has a word MMMM doesn’t allow`,
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
