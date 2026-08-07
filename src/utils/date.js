import dayjs from 'dayjs'

const parseDateValue = (value) => {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value

  const parseTimestampNumber = (rawNumber) => {
    const numberValue = Number(rawNumber)
    if (!Number.isFinite(numberValue)) return null

    const isLikelySeconds = numberValue > 1e9 && numberValue < 1e12
    const milliseconds = isLikelySeconds ? numberValue * 1000 : numberValue
    const date = new Date(milliseconds)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value === 'number') return parseTimestampNumber(value)
  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    if (/^\d+$/.test(trimmedValue)) return parseTimestampNumber(trimmedValue)
    const date = new Date(trimmedValue)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const milliseconds =
      value.seconds * 1000 +
      (typeof value.nanoseconds === 'number'
        ? Math.floor(value.nanoseconds / 1e6)
        : 0)
    const date = new Date(milliseconds)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

export const monthNames = Array.from({ length: 12 }, (_, i) =>
  dayjs().month(i).format('MMMM'),
)

export const formatDate = (value, missingText = '—') => {
  const date = parseDateValue(value)
  return date ? dayjs(date).format('D MMMM YYYY') : missingText
}

export const formatDateOrNotAvailable = (value) =>
  formatDate(value, 'Not available')

export const getCreatedDate = (record = {}) => {
  if (!record || typeof record !== 'object') return null
  return (
    record.createdAt ??
    record.created_at ??
    record.createdDate ??
    record.createdOn ??
    record.createdTimestamp ??
    record.timestamp ??
    record.created ??
    record.joinDate ??
    record.joinedAt ??
    null
  )
}

export const formatTime = (value) => {
  const date = parseDateValue(value)
  return date ? dayjs(date).format('hh:mm A') : '—'
}

export const money = (value) => {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) return '৳0'
  const absoluteValue = Math.abs(numeric)
  return `৳${absoluteValue.toLocaleString()}`
}
