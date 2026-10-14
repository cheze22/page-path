import { searchGutendex } from '../api/gutendexApi.js'
import { searchBooks } from '../api/openLibraryApi.js'
import { normalizeBooks, normalizeGutendexBooks } from './bookNormalizer.js'

function normalizedText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizedAuthor(value) {
  return normalizedText(value).split(' ').filter(Boolean).sort().join(' ')
}

function uniqueBy(items, selector = (item) => item) {
  const seen = new Set()
  return items.filter((item) => {
    const value = selector(item)
    if (!value || seen.has(value)) return false
    seen.add(value)
    return true
  })
}

function candidateKeys(book) {
  const isbnKeys = (book.isbn || []).map(
    (isbn) => `isbn:${isbn.replace(/[^0-9X]/gi, '').toUpperCase()}`,
  )
  const title = normalizedText(book.title)
  const authors = (book.authors || []).map(normalizedAuthor).filter(Boolean).sort()
  const titleAuthor = title && authors.length ? `text:${title}|${authors.join('|')}` : null
  return [...isbnKeys.filter((key) => key.length > 5), titleAuthor].filter(Boolean)
}

function prefer(first, second, field) {
  const firstValue = first[field]
  const secondValue = second[field]
  if (firstValue !== null && firstValue !== undefined && firstValue !== '') return firstValue
  return secondValue ?? null
}

export function mergeBookRecords(first, second) {
  const sources = uniqueBy([
    ...(first.sources || [first.source]),
    ...(second.sources || [second.source]),
  ])
  const formats = uniqueBy(
    [...(first.formats || []), ...(second.formats || [])],
    (format) => format.url,
  )
  return {
    ...first,
    source: sources.join(' + '),
    sources,
    sourceIds: { ...(first.sourceIds || {}), ...(second.sourceIds || {}) },
    sourceLinks: uniqueBy(
      [...(first.sourceLinks || []), ...(second.sourceLinks || [])],
      (link) => link.url,
    ),
    authors: uniqueBy([...(first.authors || []), ...(second.authors || [])], normalizedAuthor),
    authorDetails: uniqueBy(
      [...(first.authorDetails || []), ...(second.authorDetails || [])],
      (author) => normalizedText(author.name),
    ),
    authorKeys: uniqueBy([...(first.authorKeys || []), ...(second.authorKeys || [])]),
    firstPublishYear: prefer(first, second, 'firstPublishYear'),
    editionCount: prefer(first, second, 'editionCount'),
    languages: uniqueBy([...(first.languages || []), ...(second.languages || [])], normalizedText),
    subjects: uniqueBy([...(first.subjects || []), ...(second.subjects || [])], normalizedText),
    bookshelves: uniqueBy(
      [...(first.bookshelves || []), ...(second.bookshelves || [])],
      normalizedText,
    ),
    isbn: uniqueBy([...(first.isbn || []), ...(second.isbn || [])]),
    coverId: prefer(first, second, 'coverId'),
    coverImage: prefer(first, second, 'coverImage'),
    formats,
    downloadCount: prefer(first, second, 'downloadCount'),
    copyright: prefer(first, second, 'copyright'),
    isPublicDomain: Boolean(first.isPublicDomain || second.isPublicDomain),
    ebookAccess: prefer(first, second, 'ebookAccess'),
    freeEbook: Boolean(first.freeEbook || second.freeEbook || formats.length),
  }
}

export function deduplicateBooks(books = []) {
  const merged = []
  const keyToIndices = new Map()

  for (const book of books) {
    const keys = candidateKeys(book)
    const sourceSet = new Set(book.sources || [book.source])
    const candidateIndices = [...new Set(keys.flatMap((key) => keyToIndices.get(key) || []))]
    const matchIndex = candidateIndices.find((index) => {
      const existingSources = merged[index].sources || [merged[index].source]
      return existingSources.every((source) => !sourceSet.has(source))
    })
    if (matchIndex === undefined) {
      const newIndex = merged.push(book) - 1
      keys.forEach((key) => keyToIndices.set(key, [...(keyToIndices.get(key) || []), newIndex]))
      continue
    }

    merged[matchIndex] = mergeBookRecords(merged[matchIndex], book)
    candidateKeys(merged[matchIndex]).forEach((key) => {
      const indices = keyToIndices.get(key) || []
      if (!indices.includes(matchIndex)) keyToIndices.set(key, [...indices, matchIndex])
    })
  }

  return merged
}

export async function searchAllSources({
  query,
  page = 1,
  limit = 12,
  signal,
  openLibrarySearch = searchBooks,
  gutendexSearch = searchGutendex,
} = {}) {
  const [openLibraryResult, gutendexResult] = await Promise.allSettled([
    openLibrarySearch({ query, page, limit, signal }),
    gutendexSearch({ query, page, signal }),
  ])
  const availableSources = []
  const unavailableSources = []
  const errors = {}
  let openLibraryBooks = []
  let gutendexBooks = []
  let totalResults = 0
  let hasNextPage = false

  if (openLibraryResult.status === 'fulfilled') {
    availableSources.push('Open Library')
    openLibraryBooks = normalizeBooks(openLibraryResult.value.records)
    totalResults += openLibraryResult.value.totalResults
    hasNextPage ||= page * limit < openLibraryResult.value.totalResults
  } else {
    unavailableSources.push('Open Library')
    errors.openLibrary = openLibraryResult.reason
  }

  if (gutendexResult.status === 'fulfilled') {
    availableSources.push('Project Gutenberg')
    gutendexBooks = normalizeGutendexBooks(gutendexResult.value.records)
    totalResults += gutendexResult.value.totalResults
    hasNextPage ||= Boolean(gutendexResult.value.next)
  } else {
    unavailableSources.push('Project Gutenberg')
    errors.gutendex = gutendexResult.reason
  }

  if (!availableSources.length) {
    const error = new Error('Both book services are unavailable.')
    error.name = 'SearchServiceError'
    error.causes = errors
    throw error
  }

  return {
    books: deduplicateBooks([...openLibraryBooks, ...gutendexBooks]),
    totalResults,
    page,
    hasNextPage,
    availableSources,
    unavailableSources,
    partial: unavailableSources.length > 0,
    errors,
  }
}
