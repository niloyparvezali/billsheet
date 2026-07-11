import dayjs from 'dayjs'
export const monthNames = Array.from({ length: 12 }, (_, i) => dayjs().month(i).format('MMMM'))
export const formatDate = value => value?.toDate ? dayjs(value.toDate()).format('D MMMM YYYY') : '—'
export const formatTime = value => value?.toDate ? dayjs(value.toDate()).format('hh:mm A') : '—'
export const money = value => `৳${Number(value || 0).toLocaleString()}`
