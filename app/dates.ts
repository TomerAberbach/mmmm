// A calendar date, such as the expected lock date, travels as YYYY-MM-DD and
// is stored at midnight UTC, so these read it in UTC. An instant, such as when
// a bracket was published, shows as its day in Arizona, where ASU runs the
// tournament

export const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10)

export const fromIsoDate = (isoDate: string): Date =>
  new Date(`${isoDate}T00:00:00Z`)

const LONG_DATE = new Intl.DateTimeFormat(`en-US`, {
  dateStyle: `long`,
  timeZone: `UTC`,
})

// Such as "March 19, 2027"
export const formatDate = (date: Date): string => LONG_DATE.format(date)

const ARIZONA_LONG_DATE = new Intl.DateTimeFormat(`en-US`, {
  dateStyle: `long`,
  timeZone: `America/Phoenix`,
})

// The day in Arizona, such as "March 2, 2027"
export const formatArizonaDate = (date: Date): string =>
  ARIZONA_LONG_DATE.format(date)

// The time on the reader's clock, such as "2:41 PM"
export const formatTime = (date: Date): string =>
  date.toLocaleTimeString([], { hour: `numeric`, minute: `2-digit` })
