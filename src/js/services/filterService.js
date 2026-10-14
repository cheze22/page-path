function includesText(values, query) {
  const needle = query.trim().toLowerCase()
  return !needle || values.some((value) => String(value).toLowerCase().includes(needle))
}

export const DEFAULT_FILTERS = Object.freeze({
  language: '',
  topic: '',
  yearFrom: '',
  yearTo: '',
  source: '',
  freeEbook: false,
  sort: 'relevance',
})

export function filterBooks(books = [], filters = {}) {
  const state = { ...DEFAULT_FILTERS, ...filters }
  const from = Number.parseInt(state.yearFrom, 10)
  const to = Number.parseInt(state.yearTo, 10)

  return books.filter((book) => {
    if (state.language && !(book.languages || []).some((code) => code === state.language))
      return false
    if (
      state.topic &&
      !includesText([...(book.subjects || []), ...(book.bookshelves || [])], state.topic)
    ) {
      return false
    }
    if (Number.isFinite(from) && (!book.firstPublishYear || book.firstPublishYear < from))
      return false
    if (Number.isFinite(to) && (!book.firstPublishYear || book.firstPublishYear > to)) return false
    if (state.source && !(book.sources || [book.source]).includes(state.source)) return false
    if (state.freeEbook && !book.freeEbook) return false
    return true
  })
}

function descendingMissingLast(a, b, getter) {
  const left = getter(a)
  const right = getter(b)
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  return right - left
}

export function sortBooks(books = [], sort = 'relevance') {
  const result = [...books]
  if (sort === 'year') {
    result.sort((a, b) => descendingMissingLast(a, b, (book) => book.firstPublishYear))
  }
  if (sort === 'editions') {
    result.sort((a, b) => descendingMissingLast(a, b, (book) => book.editionCount))
  }
  if (sort === 'downloads') {
    result.sort((a, b) => descendingMissingLast(a, b, (book) => book.downloadCount))
  }
  return result
}

export function applyFiltersAndSort(books, filters) {
  return sortBooks(filterBooks(books, filters), filters?.sort)
}
