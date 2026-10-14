const SEARCH_ENDPOINT = 'https://openlibrary.org/search.json'

export const DEFAULT_FIELDS = [
  'key',
  'title',
  'author_name',
  'author_key',
  'first_publish_year',
  'edition_count',
  'language',
  'cover_i',
  'ebook_access',
  'subject',
  'isbn',
]

export class OpenLibraryError extends Error {
  constructor(message, { status = null, cause = null, kind = 'api' } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'OpenLibraryError'
    this.status = status
    this.kind = kind
  }
}

export async function searchBooks({
  query,
  page = 1,
  limit = 12,
  fields = DEFAULT_FIELDS,
  signal,
  fetchImpl = globalThis.fetch,
} = {}) {
  const normalizedQuery = typeof query === 'string' ? query.trim() : ''

  if (!normalizedQuery) {
    throw new OpenLibraryError('Enter a title, author, or subject to search.')
  }

  if (typeof fetchImpl !== 'function') {
    throw new OpenLibraryError('Search is unavailable in this browser.')
  }

  const safePage = Number.isInteger(page) && page > 0 ? page : 1
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 12
  const selectedFields = Array.isArray(fields) && fields.length ? fields : DEFAULT_FIELDS
  const params = new URLSearchParams({
    q: normalizedQuery,
    page: String(safePage),
    limit: String(safeLimit),
    fields: selectedFields.join(','),
  })

  let response

  try {
    response = await fetchImpl(`${SEARCH_ENDPOINT}?${params}`, { signal })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error
    }

    throw new OpenLibraryError('Open Library could not be reached.', {
      cause: error,
      kind: 'network',
    })
  }

  if (!response.ok) {
    throw new OpenLibraryError(`Open Library returned an HTTP ${response.status} error.`, {
      status: response.status,
    })
  }

  let payload

  try {
    payload = await response.json()
  } catch (error) {
    throw new OpenLibraryError('Open Library returned an unreadable response.', { cause: error })
  }

  if (!payload || !Array.isArray(payload.docs)) {
    throw new OpenLibraryError('Open Library returned an unexpected response.')
  }

  const reportedTotal = Number(payload.numFound ?? payload.num_found)
  const totalResults = Number.isFinite(reportedTotal)
    ? Math.max(0, Math.trunc(reportedTotal))
    : payload.docs.length

  return {
    records: payload.docs,
    totalResults,
    page: safePage,
    limit: safeLimit,
  }
}
