import { ARIZONA_TIME_ZONE, toIsoDate } from './dates.ts'

/**
 * The Year whose Bracket comes next. March Mammal Madness ends in April, so
 * from April on, that's next year's. Dates are in Arizona, where ASU runs it
 */
export const readUpcomingYear = (today: Date): number => {
  const { year, month } = readArizonaDate(today)
  return month >= APRIL ? year + 1 : year
}

/** Whether the year's tournament is over, so the calendar's upcoming one is later */
export const isTournamentOver = (year: number, today: Date): boolean =>
  year < readUpcomingYear(today)

const APRIL = 4

/** Whether the calendar date, at midnight UTC, is over in Arizona */
export const isPastDate = (date: Date, now: Date): boolean =>
  toIsoDate(date) < ARIZONA_ISO_DATE_FORMAT.format(now)

export const readArizonaDate = (
  date: Date,
): { year: number; month: number } => {
  const parts = ARIZONA_DATE_FORMAT.formatToParts(date)
  const readPart = (type: `year` | `month`) =>
    Number(parts.find(part => part.type === type)?.value)
  return { year: readPart(`year`), month: readPart(`month`) }
}

const ARIZONA_DATE_FORMAT = new Intl.DateTimeFormat(`en-US`, {
  timeZone: ARIZONA_TIME_ZONE,
  year: `numeric`,
  month: `numeric`,
})

/** Canada's format is YYYY-MM-DD */
const ARIZONA_ISO_DATE_FORMAT = new Intl.DateTimeFormat(`en-CA`, {
  timeZone: ARIZONA_TIME_ZONE,
  year: `numeric`,
  month: `2-digit`,
  day: `2-digit`,
})
