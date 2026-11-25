/** Such as "1 bracket" or "3 pending brackets" */
export const formatCount = (count: number, noun: string): string =>
  count === 1 ? `1 ${noun}` : `${count} ${noun}s`
