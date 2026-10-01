// Dates are YYYY-MM-DD strings, handled in UTC so the viewer's timezone can't shift a day.

export type Range = { from: string; to: string }

const DAY_MS = 86_400_000

// Mirrors the API's limit, so an oversized range is explained before it's requested.
export const MAX_WEEKS = 26

const toTime = (date: string) => Date.parse(date)
const fromTime = (time: number) => new Date(time).toISOString().slice(0, 10)

export function addDays(date: string, days: number): string {
  return fromTime(toTime(date) + days * DAY_MS)
}

export function mondayOf(date: string): string {
  const weekday = new Date(toTime(date)).getUTCDay()
  return addDays(date, -((weekday + 6) % 7))
}

export function weekCount(from: string, to: string): number {
  return (toTime(mondayOf(to)) - toTime(mondayOf(from))) / (7 * DAY_MS) + 1
}

// rangeError returns why [from, to] can't be loaded, or null if it can.
export function rangeError(from: string, to: string): string | null {
  if (!from || !to) return 'Choose a start and an end date.'
  if (to < from) return 'The end date must be on or after the start date.'
  if (weekCount(from, to) > MAX_WEEKS) {
    return `Choose at most ${MAX_WEEKS} weeks.`
  }
  return null
}

const weekFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
const rangeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

export const formatWeek = (date: string) => weekFormat.format(toTime(date))
export const formatDate = (date: string) => rangeFormat.format(toTime(date))
export const formatRange = (from: string, to: string) =>
  `${formatDate(from)} – ${formatDate(to)}`
