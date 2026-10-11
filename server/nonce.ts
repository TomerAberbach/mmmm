import { randomBytes } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import type { RequestHandler } from 'express'

// Stored on the response, not in module state, because the server build
// bundles its own copy of this module
type ResponseWithNonce = ServerResponse & { locals?: { nonce?: string } }

export const createNonce: RequestHandler = (_req, res, next) => {
  res.locals.nonce = randomBytes(16).toString(`base64`)
  next()
}

export const readNonce = (res: ServerResponse): string => {
  const nonce = (res as ResponseWithNonce).locals?.nonce
  if (!nonce) {
    throw new Error(`Run createNonce before reading the nonce`)
  }
  return nonce
}
