export const PAGE_SIZE = 100

/** `number` counts from 1 */
export type PageNumber = { number: number; count: number }

/** The page in the address, or the first for anything else */
export const readPageNumber = (request: Request): number => {
  const page = Number(new URL(request.url).searchParams.get(`page`))
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

/** The page, or the last one for a page past it */
export const toPageNumber = (page: number, total: number): PageNumber => {
  const count = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return { number: Math.min(page, count), count }
}

export const countRowsBefore = ({ number }: PageNumber): number =>
  (number - 1) * PAGE_SIZE
