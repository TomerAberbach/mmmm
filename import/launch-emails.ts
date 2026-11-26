import { setTimeout } from 'node:timers/promises'
import { href } from 'react-router'
import { CONFIRMATION_EXPIRES_IN_DAYS } from '../app/auth-forms.ts'
import { auth } from '../app/auth.server.ts'
import { prisma } from '../app/db.server.ts'
import { sendEmail } from '../app/email.server.ts'
import { launchEmail } from '../app/emails/launch.server.tsx'
import { toAppUrl } from '../app/env.server.ts'
import type { Prisma } from '../app/generated/prisma/client.ts'
import { createSecret } from '../app/secrets.server.ts'

/** An imported educator who hasn't set a password or been emailed yet */
const WAITING = {
  emailVerified: false,
  credentials: { none: {} },
  launchEmailedAt: null,
} satisfies Prisma.EducatorWhereInput

export const countWaiting = (): Promise<number> =>
  prisma.educator.count({ where: WAITING })

/** `failures` has each failed educator's ID, since logs must not hold addresses */
export type LaunchRun = {
  sent: number
  failures: { educatorId: string; error: unknown }[]
}

/** More in a row mean the service is refusing every email */
const MAX_FAILURES_IN_A_ROW = 3

/**
 * Emails up to `limit` waiting educators a link that sets a password and
 * confirms their address, oldest first, pausing between them. Goes on past an
 * address the service rejects, which keeps waiting
 */
export const sendLaunchEmails = async ({
  limit,
  pauseMs,
}: {
  limit: number
  pauseMs: number
}): Promise<LaunchRun> => {
  const educators = await prisma.educator.findMany({
    where: WAITING,
    orderBy: [{ createdAt: `asc` }, { id: `asc` }],
    take: limit,
    select: { id: true, email: true },
  })
  const run: LaunchRun = { sent: 0, failures: [] }
  let failuresInARow = 0
  for (const { id, email } of educators) {
    // Before sending, since the educator may have set a password or been
    // deleted since the run started, or another run may have emailed them
    if (!(await claim(id, email))) {
      continue
    }
    try {
      await send(id, email)
      run.sent++
      failuresInARow = 0
    } catch (error) {
      await release(id)
      run.failures.push({ educatorId: id, error })
      failuresInARow++
      if (failuresInARow === MAX_FAILURES_IN_A_ROW) {
        break
      }
    }
    await setTimeout(pauseMs)
  }
  return run
}

/** Marks a waiting educator as emailed. Returns whether they were waiting */
const claim = async (id: string, email: string): Promise<boolean> => {
  const { count } = await prisma.educator.updateMany({
    where: { ...WAITING, id, email },
    data: { launchEmailedAt: new Date() },
  })
  return count > 0
}

const release = async (id: string): Promise<void> => {
  await prisma.educator.updateMany({
    where: { id },
    data: { launchEmailedAt: null },
  })
}

const send = async (id: string, email: string): Promise<void> => {
  const url = await createResetLink(id)
  if (!(await sendEmail(launchEmail({ to: email, url })))) {
    throw new Error(`The address is over its hourly limit`)
  }
}

/** Lasts longer than the link that Forgot password sends */
const createResetLink = async (educatorId: string): Promise<string> => {
  const token = createSecret()
  const { internalAdapter } = await auth.$context
  await internalAdapter.createVerificationValue({
    identifier: `reset-password:${token}`,
    value: educatorId,
    expiresAt: new Date(Date.now() + EXPIRES_IN_MS),
  })
  const url = toAppUrl(`/api/auth/reset-password/${token}`)
  url.searchParams.set(`callbackURL`, href(`/reset-password`))
  return url.href
}

const EXPIRES_IN_MS = CONFIRMATION_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000
