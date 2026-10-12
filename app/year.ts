// The Year whose Bracket comes next. March Mammal Madness ends in April, so
// from April on, that's next year's. Dates are in Arizona, where ASU runs it
export const readUpcomingYear = (today: Date): number => {
  const { year, month } = readArizonaDate(today)
  return month >= APRIL ? year + 1 : year
}

const APRIL = 4

const readArizonaDate = (date: Date): { year: number; month: number } => {
  const parts = ARIZONA_DATE_FORMAT.formatToParts(date)
  const readPart = (type: `year` | `month`) =>
    Number(parts.find(part => part.type === type)?.value)
  return { year: readPart(`year`), month: readPart(`month`) }
}

const ARIZONA_DATE_FORMAT = new Intl.DateTimeFormat(`en-US`, {
  timeZone: `America/Phoenix`,
  year: `numeric`,
  month: `numeric`,
})
