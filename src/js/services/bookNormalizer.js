function stringArray(value) {
  if (!Array.isArray(value)) return []

  return value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
}

function positiveInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function createFallbackId(record, index) {
  const parts = [record?.title, stringArray(record?.author_name)[0], record?.first_publish_year]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return parts || `open-library-result-${index + 1}`
}

export function normalizeBook(record = {}, index = 0) {
  const safeRecord = record && typeof record === 'object' ? record : {}
  const key = typeof safeRecord.key === 'string' ? safeRecord.key.trim() : ''
  const title =
    typeof safeRecord.title === 'string' && safeRecord.title.trim()
      ? safeRecord.title.trim()
      : 'Title unavailable'

  return {
    id: key || createFallbackId(safeRecord, index),
    source: 'Open Library',
    title,
    authors: stringArray(safeRecord.author_name),
    authorKeys: stringArray(safeRecord.author_key),
    firstPublishYear: positiveInteger(safeRecord.first_publish_year),
    editionCount: positiveInteger(safeRecord.edition_count),
    languages: stringArray(safeRecord.language),
    subjects: stringArray(safeRecord.subject),
    isbn: stringArray(safeRecord.isbn),
    coverId: positiveInteger(safeRecord.cover_i),
    ebookAccess:
      typeof safeRecord.ebook_access === 'string' && safeRecord.ebook_access.trim()
        ? safeRecord.ebook_access.trim()
        : null,
  }
}

export function normalizeBooks(records) {
  if (!Array.isArray(records)) return []
  return records.map((record, index) => normalizeBook(record, index))
}
