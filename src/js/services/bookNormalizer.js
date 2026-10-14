function stringArray(value) {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()),
    ),
  ]
}

function positiveInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function createFallbackId(record, index, prefix = 'open-library') {
  const author = stringArray(record?.author_name)[0] || record?.authors?.[0]?.name
  const parts = [record?.title, author, record?.first_publish_year]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${prefix}-${parts || `result-${index + 1}`}`
}

function openLibraryLink(key) {
  return key ? `https://openlibrary.org${key.startsWith('/') ? key : `/${key}`}` : null
}

function normalizeFormats(formats) {
  if (!formats || typeof formats !== 'object' || Array.isArray(formats)) return []
  return Object.entries(formats)
    .filter(([, url]) => typeof url === 'string' && /^https?:\/\//.test(url))
    .map(([mimeType, url]) => ({ mimeType, url }))
}

export function normalizeBook(record = {}, index = 0) {
  const safeRecord = record && typeof record === 'object' ? record : {}
  const key = typeof safeRecord.key === 'string' ? safeRecord.key.trim() : ''
  const id = key || createFallbackId(safeRecord, index)
  const title =
    typeof safeRecord.title === 'string' && safeRecord.title.trim()
      ? safeRecord.title.trim()
      : 'Title unavailable'

  const sourceUrl = openLibraryLink(key)
  const ebookAccess =
    typeof safeRecord.ebook_access === 'string' && safeRecord.ebook_access.trim()
      ? safeRecord.ebook_access.trim()
      : null
  const coverId = positiveInteger(safeRecord.cover_i)

  return {
    id,
    source: 'Open Library',
    sources: ['Open Library'],
    sourceIds: { openLibrary: id },
    sourceLinks: sourceUrl ? [{ source: 'Open Library', url: sourceUrl }] : [],
    title,
    authors: stringArray(safeRecord.author_name),
    authorDetails: [],
    authorKeys: stringArray(safeRecord.author_key),
    firstPublishYear: positiveInteger(safeRecord.first_publish_year),
    editionCount: positiveInteger(safeRecord.edition_count),
    languages: stringArray(safeRecord.language),
    subjects: stringArray(safeRecord.subject),
    bookshelves: [],
    isbn: stringArray(safeRecord.isbn),
    coverId,
    coverImage: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
    formats: [],
    downloadCount: null,
    copyright: null,
    isPublicDomain: false,
    ebookAccess,
    freeEbook: ebookAccess === 'public',
  }
}

export function normalizeGutendexBook(record = {}, index = 0) {
  const safeRecord = record && typeof record === 'object' ? record : {}
  const numericId = positiveInteger(safeRecord.id)
  const id = numericId ? `gutenberg-${numericId}` : createFallbackId(safeRecord, index, 'gutenberg')
  const title =
    typeof safeRecord.title === 'string' && safeRecord.title.trim()
      ? safeRecord.title.trim()
      : 'Title unavailable'
  const authorDetails = Array.isArray(safeRecord.authors)
    ? safeRecord.authors
        .filter((author) => author && typeof author === 'object')
        .map((author) => ({
          name: typeof author.name === 'string' ? author.name.trim() : '',
          birthYear: positiveInteger(author.birth_year),
          deathYear: positiveInteger(author.death_year),
        }))
        .filter((author) => author.name)
    : []
  const formats = normalizeFormats(safeRecord.formats)
  const coverImage = formats.find(({ mimeType }) => mimeType.startsWith('image/'))?.url || null
  const sourceUrl = numericId ? `https://www.gutenberg.org/ebooks/${numericId}` : null
  const copyright = typeof safeRecord.copyright === 'boolean' ? safeRecord.copyright : null

  return {
    id,
    source: 'Project Gutenberg',
    sources: ['Project Gutenberg'],
    sourceIds: { gutendex: numericId },
    sourceLinks: sourceUrl ? [{ source: 'Project Gutenberg', url: sourceUrl }] : [],
    title,
    authors: authorDetails.map((author) => author.name),
    authorDetails,
    authorKeys: [],
    firstPublishYear: null,
    editionCount: null,
    languages: stringArray(safeRecord.languages),
    subjects: stringArray(safeRecord.subjects),
    bookshelves: stringArray(safeRecord.bookshelves),
    isbn: [],
    coverId: null,
    coverImage,
    formats,
    downloadCount: Number.isFinite(Number(safeRecord.download_count))
      ? Math.max(0, Math.trunc(Number(safeRecord.download_count)))
      : null,
    copyright,
    isPublicDomain: copyright === false,
    ebookAccess: formats.length ? 'public' : null,
    freeEbook: formats.some(({ mimeType }) => !mimeType.startsWith('image/')),
  }
}

export function normalizeBooks(records) {
  if (!Array.isArray(records)) return []
  return records.map((record, index) => normalizeBook(record, index))
}

export function normalizeGutendexBooks(records) {
  if (!Array.isArray(records)) return []
  return records.map((record, index) => normalizeGutendexBook(record, index))
}
