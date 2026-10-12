import { parseWithZod } from '@conform-to/zod/v4'
import { expect, test } from 'vitest'
import { z } from 'zod'
import { rejectSubmission } from './reject-submission.server.ts'

test(`a rejection sends back every field except those named for a password`, () => {
  const formData = new FormData()
  formData.set(`email`, `ada@school.org`)
  formData.set(`password`, `hunter2`)
  formData.set(`confirmNewPassword`, `hunter2`)
  const submission = parseWithZod(formData, {
    schema: z.object({ email: z.string() }),
  })

  const { data } = rejectSubmission(submission)

  expect(data.result.initialValue).toStrictEqual({ email: `ada@school.org` })
})
