import dayjs from 'dayjs'

const parseDateValue = (value) => {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const monthNames = Array.from({ length: 12 }, (_, i) =>
  dayjs().month(i).format('MMMM'),
)

export const formatDate = (value) => {
  const date = parseDateValue(value)
  return date ? dayjs(date).format('D MMMM YYYY') : '—'
}

export const formatTime = (value) => {
  const date = parseDateValue(value)
  return date ? dayjs(date).format('hh:mm A') : '—'
}

export const money = (value) => `৳${Number(value || 0).toLocaleString()}`
