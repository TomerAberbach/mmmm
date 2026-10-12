import { expect, test } from 'vitest'
import { serverFreeTextSchema } from './free-text.server.ts'

const NAME = serverFreeTextSchema({ label: `your full name`, maxLength: 20 })

const errorFor = (text: string): string | undefined =>
  NAME.safeParse(text).error?.issues[0]?.message

test.each([
  `Maya R.`,
  `Cassandra Dickens`,
  `Dick Smith`,
  `Mr. Hancock`,
  `Assunta Shitake`,
])(`the filter keeps the real name %s`, name => {
  expect(errorFor(name)).toBeUndefined()
})

test.each([`sh1t`, `b1tch face`, `ｆｕｃｋ`])(
  `the filter rejects %s, written to dodge it`,
  name => {
    expect(errorFor(name)).toBe(
      `Remove the offensive words from your full name`,
    )
  },
)

test(`blank text asks for the field`, () => {
  expect(errorFor(` `.repeat(3))).toBe(`Enter your full name`)
})

test(`text past the limit asks for a shorter one`, () => {
  expect(errorFor(`A`.repeat(21))).toBe(
    `Shorten your full name to 20 characters or fewer`,
  )
})
