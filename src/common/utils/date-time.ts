const RFC_3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/i

const POSTGRES_TEXT =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?([+-]\d{2})(?::?(\d{2}))?$/

type DateTimeParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  fraction: string
  offset: string
}

const OFFSET = /^[+-](\d{2}):(\d{2})$/

const MAX_OFFSET_HOURS = 15
const MAX_OFFSET_MINUTES = 59

function zeroOffsetAsZulu(offset: string): string {
  return /^[+-]00:00$/.test(offset) ? 'Z' : offset
}

function isOffset(offset: string): boolean {
  const parsed = OFFSET.exec(offset)

  if (!parsed) {
    return offset === 'Z'
  }

  const [, hours, minutes] = parsed

  return (
    Number(hours) <= MAX_OFFSET_HOURS && Number(minutes) <= MAX_OFFSET_MINUTES
  )
}

function isCalendarDay(year: number, month: number, day: number): boolean {
  const probe = new Date(Date.UTC(year, month - 1, day))

  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  )
}

function isClockTime(hour: number, minute: number, second: number): boolean {
  return hour <= 23 && minute <= 59 && second <= 59
}

function partsOf(value: string): DateTimeParts | null {
  const rfc = RFC_3339.exec(value)

  if (rfc) {
    const [, year, month, day, hour, minute, second, fraction = '', offset] =
      rfc

    return {
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second),
      fraction,
      offset: zeroOffsetAsZulu(offset.toUpperCase())
    }
  }

  const pg = POSTGRES_TEXT.exec(value)

  if (!pg) {
    return null
  }

  const [
    ,
    year,
    month,
    day,
    hour,
    minute,
    second,
    fraction = '',
    offsetHours,
    offsetMinutes = '00'
  ] = pg

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
    fraction,
    offset: zeroOffsetAsZulu(`${offsetHours}:${offsetMinutes}`)
  }
}

function validParts(value: string): DateTimeParts | null {
  const parts = partsOf(value)

  if (
    !parts ||
    !isCalendarDay(parts.year, parts.month, parts.day) ||
    !isClockTime(parts.hour, parts.minute, parts.second) ||
    !isOffset(parts.offset)
  ) {
    return null
  }

  return parts
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function isRfc3339DateTime(value: string): boolean {
  return RFC_3339.test(value) && validParts(value) !== null
}

export function isStoredDateTime(value: string): boolean {
  return validParts(value) !== null
}

export function toRfc3339(value: string): string | null {
  const parts = validParts(value)

  if (!parts) {
    return null
  }

  const date = `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(parts.day)}`
  const time = `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}${parts.fraction}`

  return `${date}T${time}${parts.offset}`
}
