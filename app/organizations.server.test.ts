import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { createEducator } from '../test/educators.ts'
import {
  joinOrganization,
  nameOrganization,
  readEmailDomain,
  readOrganization,
  readOrganizations,
  renameOrganization,
} from './organizations.server.ts'

/** Stores an educator at the domain who has joined its organization */
const addEducator = async (
  domain: string,
  { emailVerified = true } = {},
): Promise<string> => {
  const id = await createEducator(undefined, { domain, emailVerified })
  await joinOrganization(id)
  return id
}

const newDomain = () => `${randomUUID()}.edu`

test.each([
  [`frizzle@walkerville.edu`, `walkerville.edu`],
  [`frizzle@Walkerville.EDU`, `walkerville.edu`],
  [`frizzle@gmail.com`, null],
  [`frizzle@outlook.com`, null],
  [`frizzle@yahoo.com`, null],
  [`frizzle@icloud.com`, null],
  [`frizzle@privaterelay.appleid.com`, null],
])(`the organization of %s is %s`, (email, domain) => {
  expect(readEmailDomain(email)).toBe(domain)
})

test(`educators at one domain share an organization`, async () => {
  const domain = newDomain()
  const first = await addEducator(domain)
  const second = await addEducator(domain)

  await nameOrganization(first, `Walkerville Elementary`)

  await expect(readOrganization(second)).resolves.toStrictEqual({
    domain,
    name: `Walkerville Elementary`,
  })
})

test(`an educator at a free email provider has no organization`, async () => {
  const id = await addEducator(`gmail.com`)

  await expect(readOrganization(id)).resolves.toBeNull()
  await expect(nameOrganization(id, `Gmail`)).resolves.toBe(false)
})

test(`an educator who hasn't confirmed their address has no organization`, async () => {
  const id = await addEducator(newDomain(), { emailVerified: false })

  await expect(readOrganization(id)).resolves.toBeNull()
})

test(`only the first name given is kept`, async () => {
  const domain = newDomain()
  const first = await addEducator(domain)
  const second = await addEducator(domain)

  const named = await nameOrganization(first, `Walkerville Elementary`)
  const renamed = await nameOrganization(second, `Another name`)

  expect([named, renamed]).toStrictEqual([true, false])
  await expect(readOrganization(first)).resolves.toMatchObject({
    name: `Walkerville Elementary`,
  })
})

test(`the admin renames an organization`, async () => {
  const domain = newDomain()
  await addEducator(domain)

  const renamed = await renameOrganization(domain, `Walkerville Elementary`)

  expect(renamed).toBe(true)
  await expect(readOrganizations()).resolves.toContainEqual({
    domain,
    name: `Walkerville Elementary`,
    educatorCount: 1,
  })
})
