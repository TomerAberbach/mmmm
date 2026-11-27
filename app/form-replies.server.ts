import type { Submission, SubmissionResult } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { data } from 'react-router'
import type { z } from 'zod'
import { idsSchema } from './id-list.ts'

/** What an action answers once it saves a form submitted through a fetcher */
export type SavedResult = { result: SubmissionResult; saved?: true }

/**
 * What an action answers a change that a page confirms. `isStale` offers a
 * reload beside the error
 */
export type ConfirmResult = { ok: true } | { error: string; isStale?: true }

/** What an action returns for a `ConfirmResult`. Errors need `refuseChange` */
export type ConfirmReply = { ok: true } | ReturnType<typeof refuseChange>

/**
 * Answers a change the action refuses. The status keeps the page's loaders from
 * running again, since new data could remove the dialog that shows the error
 */
export const refuseChange = (
  error: string,
): ReturnType<typeof data<ConfirmResult>> =>
  data<ConfirmResult>({ error }, { status: 409 })

/** Answers a change refused because the page shows old data */
export const refuseStale = (error: string): ReturnType<typeof refuseChange> =>
  data<ConfirmResult>({ error, isStale: true }, { status: 409 })

type FormErrors = {
  formErrors?: string[]
  fieldErrors?: Record<string, string[]>
}

const BAD_REQUEST: ResponseInit = { status: 400 }

/**
 * The reply never sends a password back to the browser, so it drops every
 * field whose name mentions one
 */
export const rejectForm = (
  submission: Submission<unknown>,
  errors: FormErrors = {},
  init: ResponseInit = BAD_REQUEST,
): ReturnType<typeof data<{ result: SubmissionResult }>> =>
  data(
    {
      result: submission.reply({
        ...errors,
        hideFields: readPasswordFields(submission),
      }),
    },
    init,
  )

export type FormRejection = ReturnType<typeof rejectForm>

const readPasswordFields = (submission: Submission<unknown>): string[] =>
  Object.keys(submission.payload).filter(name => /password/iu.test(name))

export const acceptForm = (
  submission: Submission<unknown>,
  options?: { resetForm?: boolean },
): SavedResult => ({ result: submission.reply(options), saved: true })

/**
 * Answers a form submitted through a fetcher. `save` runs on a valid form, and
 * resolves to the errors that kept it from saving, or to null
 */
export const saveForm = async <Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
  save: (value: z.output<Schema>) => Promise<FormErrors | null>,
  options?: { resetForm?: boolean },
): Promise<SavedResult | FormRejection> => {
  const submission = parseWithZod(await request.formData(), { schema })
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }
  const errors = await save(submission.value)
  return errors
    ? rejectForm(submission, errors)
    : acceptForm(submission, options)
}

/**
 * Runs `change` on the IDs the form lists, and reports an error when it changed
 * nothing. `done` names the change, such as "deleted"
 */
export const changeListed = async (
  request: Request,
  change: (ids: string[]) => Promise<number>,
  done: string,
): Promise<ConfirmReply> => {
  const parsed = idsSchema.safeParse(
    Object.fromEntries(await request.formData()),
  )
  const count = parsed.success ? await change(parsed.data.ids) : 0
  return count > 0
    ? { ok: true }
    : refuseStale(`Nothing was ${done}. Reload the page and try again`)
}
