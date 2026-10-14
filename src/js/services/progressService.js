const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function localDate(value) {
  if (!DATE_PATTERN.test(value || '')) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  date.setHours(0, 0, 0, 0)
  return date
}

export function countReadingDays(start, finish, preferredDays = []) {
  const selected = new Set(
    preferredDays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  )
  let count = 0
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  while (cursor <= finish) {
    if (!selected.size || selected.has(cursor.getDay())) count += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

export function calculateProgress(progress = {}, now = new Date()) {
  const currentPage = Number(progress.currentPage)
  const totalPages = Number(progress.totalPages)
  const errors = []

  if (!Number.isInteger(currentPage) || currentPage < 0) {
    errors.push('Current page must be zero or a positive whole number.')
  }
  if (!Number.isInteger(totalPages) || totalPages <= 0) {
    errors.push('Total pages must be a positive whole number.')
  }
  if (Number.isInteger(currentPage) && Number.isInteger(totalPages) && currentPage > totalPages) {
    errors.push('Current page cannot be greater than total pages.')
  }

  const hasTarget = typeof progress.targetDate === 'string' && progress.targetDate.length > 0
  const targetDate = hasTarget ? localDate(progress.targetDate) : null
  if (hasTarget && !targetDate) errors.push('Choose a valid target finish date.')

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  if (targetDate && targetDate < today) errors.push('Target finish date cannot be in the past.')
  if (errors.length)
    return {
      valid: false,
      errors,
      completionPercentage: 0,
      remainingPages: null,
      pagesPerReadingDay: null,
    }

  const remainingPages = totalPages - currentPage
  const completionPercentage = Math.round((currentPage / totalPages) * 100)
  const readingDays = targetDate
    ? countReadingDays(today, targetDate, progress.preferredDays || [])
    : null
  const pagesPerReadingDay = readingDays ? Math.ceil(remainingPages / readingDays) : null

  return {
    valid: true,
    errors: [],
    completionPercentage,
    remainingPages,
    pagesPerReadingDay,
    readingDays,
  }
}
