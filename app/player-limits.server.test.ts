import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { CLIENT_IP_HEADER } from './client-ip.ts'
import { limitNewPlayer } from './player-limits.server.ts'

const requestFrom = (ip: string): Request =>
  new Request(`http://localhost/play/secret`, {
    method: `POST`,
    headers: { [CLIENT_IP_HEADER]: ip },
  })

// Resolves to the last attempt's refusal, if any
const startBrackets = async (
  times: number,
  contestId: string,
  ip: string,
): Promise<string | undefined> => {
  let refusal: string | undefined
  for (let index = 0; index < times; index++) {
    refusal = (await limitNewPlayer(requestFrom(ip), contestId))?.message
  }
  return refusal
}

test(`a contest takes 300 new brackets an hour, then says when to try again`, async () => {
  const contestId = randomUUID()
  await startBrackets(300, contestId, `203.0.113.1`)

  const refusal = await limitNewPlayer(requestFrom(`203.0.113.2`), contestId)

  expect(refusal?.message).toBe(
    `Too many new brackets right now. Try again in 60 minutes`,
  )
})

test(`an IP address takes 1000 new brackets an hour across contests`, async () => {
  const ip = `198.51.100.7`
  for (let index = 0; index < 4; index++) {
    await startBrackets(250, randomUUID(), ip)
  }

  const refusal = await limitNewPlayer(requestFrom(ip), randomUUID())

  expect(refusal?.message).toMatch(/^Too many new brackets right now/u)
})

test(`a request the IP address limit refuses costs the contest nothing`, async () => {
  const exhaustedIp = `198.51.100.9`
  for (let index = 0; index < 4; index++) {
    await startBrackets(250, randomUUID(), exhaustedIp)
  }
  const contestId = randomUUID()
  await startBrackets(10, contestId, exhaustedIp)

  const lastOf300 = await startBrackets(300, contestId, `203.0.113.50`)

  expect(lastOf300).toBeUndefined()
})
