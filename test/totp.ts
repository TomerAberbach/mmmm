import { createHmac } from 'node:crypto'

const BASE32_ALPHABET = `ABCDEFGHIJKLMNOPQRSTUVWXYZ234567`

// The code an authenticator app shows now for an otpauth:// URI, per RFC 6238
// with its defaults: SHA-1, 6 digits, and a 30-second period
export const readTotpCode = (totpUri: string, now = Date.now()): string => {
  const secret = new URL(totpUri).searchParams.get(`secret`)
  if (!secret) {
    throw new Error(`No secret in ${totpUri}`)
  }
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)))
  const hmac = createHmac(`sha1`, decodeBase32(secret)).update(counter).digest()
  const offset = (hmac.at(-1) ?? 0) & 0xf
  const code = (hmac.readUInt32BE(offset) & 0x7f_ff_ff_ff) % 1_000_000
  return String(code).padStart(6, `0`)
}

const decodeBase32 = (text: string): Buffer => {
  let bits = ``
  for (const character of text.replaceAll(`=`, ``).toUpperCase()) {
    bits += BASE32_ALPHABET.indexOf(character).toString(2).padStart(5, `0`)
  }
  const bytes = bits.match(/.{8}/gu) ?? []
  return Buffer.from(bytes.map(byte => Number.parseInt(byte, 2)))
}
