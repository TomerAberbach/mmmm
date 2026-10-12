import { expect, test } from 'vitest'
import { readUpcomingYear } from './year.ts'

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
