import { createHash, randomBytes } from 'node:crypto'

// A link's secret: 256 random bits by default, written in URL-safe characters
export const createSecret = (bytes = 32): string =>
  randomBytes(bytes).toString(`base64url`)

// Store this instead of a secret that only its link should hold, so reading
// the database reveals no working link. The secret's random bits make a fast
// hash as strong as a slow one
export const hashSecret = (secret: string): string =>
  createHash(`sha256`).update(secret).digest(`base64url`)
