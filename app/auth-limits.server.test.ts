import { APIError } from 'better-auth/api'
import { expect, test } from 'vitest'
import {
  limitAuthRequest,
  refundAuthRequest,
  TOO_MANY_ATTEMPTS,
} from './auth-limits.server.ts'
import { CLIENT_IP_HEADER } from './client-ip.ts'

// Each test uses its own addresses, since the limits count across the process
const uniqueEmail = (): string => `educator-${crypto.randomUUID()}@example.com`

const uniqueIp = (): string =>
  `10.${randomByte()}.${randomByte()}.${randomByte()}`

const randomByte = (): number => Math.floor(Math.random() * 256)

const fromIp = (ip: string): Headers => new Headers({ [CLIENT_IP_HEADER]: ip })

const attempt = (path: string, email: string, ip: string) =>
  limitAuthRequest({ path, email, headers: fromIp(ip) })

// Takes a function for a value that changes on each attempt
const attemptTimes = async (
  times: number,
  path: string,
  email: string | (() => string),
  ip: string | (() => string),
): Promise<void> => {
  for (let i = 0; i < times; i++) {
    await attempt(path, readValue(email), readValue(ip))
  }
}

const readValue = (value: string | (() => string)): string =>
  typeof value === `string` ? value : value()

test(`an address gets 3 sign-ups an hour from one IP address`, async () => {
  const email = uniqueEmail()
  const ip = uniqueIp()
  await attemptTimes(3, `/sign-up/email`, email, ip)

  const fourth = attempt(`/sign-up/email`, email, ip)

  await expect(fourth).rejects.toMatchObject({
    statusCode: 429,
    body: {
      code: TOO_MANY_ATTEMPTS,
      message: `Too many attempts. Try again in 60 minutes.`,
    },
  })
})

test(`an address counts the same in any case`, async () => {
  const email = uniqueEmail()
  const ip = uniqueIp()
  await attemptTimes(3, `/request-password-reset`, email, ip)

  const shouted = attempt(
    `/request-password-reset`,
    ` ${email.toUpperCase()} `,
    ip,
  )

  await expect(shouted).rejects.toBeInstanceOf(APIError)
})

test(`an IP address gets 100 sign-ins every 15 minutes across addresses`, async () => {
  const ip = uniqueIp()
  await attemptTimes(100, `/sign-in/email`, uniqueEmail, ip)

  const next = attempt(`/sign-in/email`, uniqueEmail(), ip)

  await expect(next).rejects.toBeInstanceOf(APIError)
})

test(`an address gets 10 sign-ins every 15 minutes from one IP address`, async () => {
  const email = uniqueEmail()
  const ip = uniqueIp()
  await attemptTimes(10, `/sign-in/email`, email, ip)

  const next = attempt(`/sign-in/email`, email, ip)

  await expect(next).rejects.toBeInstanceOf(APIError)
})

test(`failed sign-ins from one IP address don't lock out the educator elsewhere`, async () => {
  const email = uniqueEmail()
  const attacker = uniqueIp()
  await attemptTimes(10, `/sign-in/email`, email, attacker)

  const fromEducator = attempt(`/sign-in/email`, email, uniqueIp())

  await expect(fromEducator).resolves.toBeUndefined()
})

test(`failed sign-ins from many IP addresses don't lock out the educator`, async () => {
  const email = uniqueEmail()
  await attemptTimes(200, `/sign-in/email`, email, uniqueIp)

  const fromEducator = attempt(`/sign-in/email`, email, uniqueIp())

  await expect(fromEducator).resolves.toBeUndefined()
})

test(`a refused address doesn't spend its IP address's attempts`, async () => {
  const email = uniqueEmail()
  const ip = uniqueIp()
  await attemptTimes(3, `/sign-up/email`, email, ip)
  const refused = await Promise.allSettled(
    Array.from({ length: 50 }, () => attempt(`/sign-up/email`, email, ip)),
  )
  expect(refused.every(({ status }) => status === `rejected`)).toBe(true)

  const fromClassmates = attemptTimes(97, `/sign-up/email`, uniqueEmail, ip)

  await expect(fromClassmates).resolves.toBeUndefined()
})

test(`IPv6 addresses in one /56 network share a count`, async () => {
  const network = `2001:db8:${randomByte().toString(16)}${randomByte().toString(16)}`
  await attemptTimes(
    100,
    `/sign-in/email`,
    uniqueEmail,
    () => `${network}:00${randomByte().toString(16)}::1`,
  )

  const neighbor = attempt(
    `/sign-in/email`,
    uniqueEmail(),
    `${network}:00ff::2`,
  )

  await expect(neighbor).rejects.toBeInstanceOf(APIError)
})

test(`paths without limits always pass`, async () => {
  const email = uniqueEmail()
  const ip = uniqueIp()

  const attempts = attemptTimes(200, `/update-user`, email, ip)

  await expect(attempts).resolves.toBeUndefined()
})

test(`an address too long for RFC 5321 still gets 3 sign-ups an hour from one IP address`, async () => {
  const oversized = `${crypto.randomUUID()}${`a`.repeat(300)}@example.com`
  const ip = uniqueIp()
  await attemptTimes(3, `/sign-up/email`, oversized, ip)

  const fourth = attempt(`/sign-up/email`, oversized, ip)

  await expect(fourth).rejects.toBeInstanceOf(APIError)
})

test(`resets for an address from other IP addresses don't lock out its owner`, async () => {
  const email = uniqueEmail()
  await attemptTimes(20, `/request-password-reset`, email, uniqueIp)

  const fromOwner = attempt(`/request-password-reset`, email, uniqueIp())

  await expect(fromOwner).resolves.toBeUndefined()
})

test(`successful sign-ins don't use up a school's IP address`, async () => {
  const ip = uniqueIp()
  for (let signIn = 0; signIn < 150; signIn++) {
    const request = {
      path: `/sign-in/email`,
      email: uniqueEmail(),
      headers: fromIp(ip),
    }
    await limitAuthRequest(request)
    await refundAuthRequest(request)
  }

  const next = attempt(`/sign-in/email`, uniqueEmail(), ip)

  await expect(next).resolves.toBeUndefined()
})

test(`refunds without a counted attempt give an IP address no extra attempts`, async () => {
  const ip = uniqueIp()
  for (let refund = 0; refund < 5; refund++) {
    await refundAuthRequest({
      path: `/sign-in/email`,
      email: undefined,
      headers: fromIp(ip),
    })
  }
  await attemptTimes(100, `/sign-in/email`, uniqueEmail, ip)

  const next = attempt(`/sign-in/email`, uniqueEmail(), ip)

  await expect(next).rejects.toBeInstanceOf(APIError)
})

test(`a limited request without the client's IP address fails loudly`, async () => {
  const unattributed = limitAuthRequest({
    path: `/sign-in/email`,
    email: uniqueEmail(),
    headers: new Headers(),
  })

  await expect(unattributed).rejects.toThrow(`Pass the request's headers`)
})
