const GUTENDEX_ENDPOINT = 'https://gutendex.com/books/'

export class GutendexError extends Error {
  constructor(message, { status = null, cause = null, kind = 'api' } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'GutendexError'
    this.status = status
    this.kind = kind
  }
}

function optionalList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(',')
  return typeof value === 'string' ? value.trim() : ''
}

export async function searchGutendex({
  query,
  page = 1,
  language,
  topic,
  signal,
  fetchImpl = globalThis.fetch,
} = {}) {
  const normalizedQuery = typeof query === 'string' ? query.trim() : ''

  if (!normalizedQuery) throw new GutendexError('Enter a title, author, or subject to search.')
  if (typeof fetchImpl !== 'function') {
    throw new GutendexError('Project Gutenberg search is unavailable in this browser.')
  }

  const safePage = Number.isInteger(page) && page > 0 ? page : 1
  const params = new URLSearchParams({ search: normalizedQuery, page: String(safePage) })
  const languages = optionalList(language)
  const topicValue = typeof topic === 'string' ? topic.trim() : ''
  if (languages) params.set('languages', languages)
  if (topicValue) params.set('topic', topicValue)

  let response
  try {
    response = await fetchImpl(`${GUTENDEX_ENDPOINT}?${params}`, { signal })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new GutendexError('Project Gutenberg could not be reached.', {
      cause: error,
      kind: 'network',
    })
  }

  if (!response.ok) {
    throw new GutendexError(`Gutendex returned an HTTP ${response.status} error.`, {
      status: response.status,
    })
  }

  let payload
  try {
    payload = await response.json()
  } catch (error) {
    throw new GutendexError('Gutendex returned an unreadable response.', { cause: error })
  }

  if (!payload || !Array.isArray(payload.results)) {
    throw new GutendexError('Gutendex returned an unexpected response.')
  }

  const reportedCount = Number(payload.count)
  return {
    records: payload.results,
    totalResults: Number.isFinite(reportedCount)
      ? Math.max(0, Math.trunc(reportedCount))
      : payload.results.length,
    page: safePage,
    next: typeof payload.next === 'string' ? payload.next : null,
    previous: typeof payload.previous === 'string' ? payload.previous : null,
  }
}
