/** Such as "1 bracket" or "3 pending brackets" */
export const formatCount = (count: number, noun: string): string =>
  `${count} ${pluralize(count, noun)}`

export const pluralize = (count: number, noun: string): string =>
  count === 1 ? noun : `${noun}s`
