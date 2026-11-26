import { expect, test } from 'vitest'
import { isPastDate, readUpcomingYear } from './year.ts'

test.each([
  { today: `2027-01-15T12:00:00Z`, upcomingYear: 2027 },
  { today: `2027-03-15T12:00:00Z`, upcomingYear: 2027 },
  { today: `2027-04-15T12:00:00Z`, upcomingYear: 2028 },
  { today: `2026-10-12T12:00:00Z`, upcomingYear: 2027 },
])(
  `on $today the upcoming year is $upcomingYear`,
  ({ today, upcomingYear }) => {
    expect(readUpcomingYear(new Date(today))).toBe(upcomingYear)
  },
)

// Arizona is UTC-7 all year
test.each([
  { today: `2027-04-01T06:59:59Z`, upcomingYear: 2027 },
  { today: `2027-04-01T07:00:00Z`, upcomingYear: 2028 },
])(
  `the upcoming year changes at midnight in Arizona: $today is $upcomingYear`,
  ({ today, upcomingYear }) => {
    expect(readUpcomingYear(new Date(today))).toBe(upcomingYear)
  },
)

test.each([
  { now: `2027-03-20T06:59:59Z`, isPast: false },
  { now: `2027-03-20T07:00:00Z`, isPast: true },
])(
  `March 19 ends at midnight in Arizona: at $now it's past: $isPast`,
  ({ now, isPast }) => {
    expect(isPastDate(new Date(`2027-03-19T00:00:00Z`), new Date(now))).toBe(
      isPast,
    )
  },
)
