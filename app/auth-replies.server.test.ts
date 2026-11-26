import { parseWithZod } from '@conform-to/zod/v4'
import { APIError } from 'better-auth/api'
import { expect, test } from 'vitest'
import { confirmPasswordSchema } from './auth-forms.ts'
import { rejectAuthError } from './auth-replies.server.ts'

test.each([`INVALID_PASSWORD`, `PASSWORD_TOO_LONG`])(
  `%s answers as a wrong password`,
  code => {
    const formData = new FormData()
    formData.set(`password`, `correct-horse-battery`)
    const submission = parseWithZod(formData, { schema: confirmPasswordSchema })

    const { data } = rejectAuthError(
      submission,
      new APIError(`BAD_REQUEST`, { code }),
      { passwordField: `password` },
    )

    expect(data.result.error).toStrictEqual({
      password: [`Your password is incorrect`],
    })
  },
)
