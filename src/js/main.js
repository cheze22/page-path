import '../css/base.css'
import '../css/components.css'
import '../css/responsive.css'

import { searchBooks } from './api/openLibraryApi.js'
import { createBookCard } from './components/bookCard.js'
import { createStatusController } from './components/statusMessage.js'
import { normalizeBooks } from './services/bookNormalizer.js'
import { createSearchUrl, readSearchState } from './utils/searchUrl.js'

const PAGE_SIZE = 12

const elements = {
  form: document.querySelector('#searchForm'),
  input: document.querySelector('#searchInput'),
  inputError: document.querySelector('#searchError'),
  grid: document.querySelector('#resultsGrid'),
  status: document.querySelector('#statusMessage'),
  resultCount: document.querySelector('#resultCount'),
  pagination: document.querySelector('#pagination'),
  previousButton: document.querySelector('#previousPage'),
  nextButton: document.querySelector('#nextPage'),
  pageIndicator: document.querySelector('#pageIndicator'),
  resultsHeading: document.querySelector('#resultsHeading'),
}

const statusMessage = createStatusController(elements.status)
let activeSearch = { query: '', page: 1, totalResults: 0 }
let activeRequest = null

function formatResultCount(total) {
  return `${total.toLocaleString()} ${total === 1 ? 'result' : 'results'}`
}

function clearResults() {
  elements.grid.replaceChildren()
  elements.resultCount.textContent = ''
  elements.pagination.hidden = true
}

function setLoading(isLoading) {
  elements.grid.setAttribute('aria-busy', String(isLoading))
  elements.input.disabled = isLoading
  elements.form.querySelector('button[type="submit"]').disabled = isLoading
}

function showInputError(message = '') {
  elements.inputError.textContent = message
  elements.input.setAttribute('aria-invalid', message ? 'true' : 'false')
}

function updatePagination(page, totalResults, resultCount) {
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE))
  const hasNextPage = page < totalPages && resultCount > 0

  elements.previousButton.disabled = page <= 1
  elements.nextButton.disabled = !hasNextPage
  elements.pageIndicator.textContent = `Page ${page} of ${totalPages}`
  elements.pagination.hidden = false
}

function renderResults(books, { page, totalResults }) {
  const fragment = document.createDocumentFragment()
  books.forEach((book) => fragment.append(createBookCard(book)))
  elements.grid.replaceChildren(fragment)
  elements.resultCount.textContent = formatResultCount(totalResults)
  statusMessage.hide()
  updatePagination(page, totalResults, books.length)
}

function showSearchFailure(error) {
  clearResults()

  if (!navigator.onLine) {
    statusMessage.show('offline')
    return
  }

  let message = 'Open Library returned an unexpected response. Please try again in a moment.'

  if (error?.status) {
    message = `Open Library returned an error (${error.status}). Please try again in a moment.`
  } else if (error?.kind === 'network') {
    message = 'Open Library could not be reached. Check your connection and try again.'
  }

  statusMessage.show('error', { message })
}

async function loadSearch({ query, page }) {
  activeRequest?.abort()
  const requestController = new AbortController()
  activeRequest = requestController
  activeSearch = { query, page, totalResults: 0 }
  elements.input.value = query
  showInputError()
  clearResults()

  if (!navigator.onLine) {
    setLoading(false)
    statusMessage.show('offline')
    return
  }

  setLoading(true)
  statusMessage.show('loading')

  try {
    const response = await searchBooks({
      query,
      page,
      limit: PAGE_SIZE,
      signal: requestController.signal,
    })
    const books = normalizeBooks(response.records)
    activeSearch = { query, page, totalResults: response.totalResults }

    if (!books.length) {
      clearResults()
      statusMessage.show('empty')
      return
    }

    renderResults(books, activeSearch)
  } catch (error) {
    if (error?.name !== 'AbortError') {
      showSearchFailure(error)
    }
  } finally {
    if (activeRequest === requestController && !requestController.signal.aborted) {
      setLoading(false)
    }
  }
}

function navigateToSearch(query, page, { replace = false } = {}) {
  const nextUrl = createSearchUrl(query, page)
  window.history[replace ? 'replaceState' : 'pushState']({ query, page }, '', nextUrl)
  void loadSearch({ query, page })
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault()
  const query = elements.input.value.trim()

  if (!query) {
    activeRequest?.abort()
    setLoading(false)
    showInputError('Enter a title, author, or subject before searching.')
    elements.input.focus()
    return
  }

  navigateToSearch(query, 1)
})

elements.input.addEventListener('input', () => {
  if (elements.input.value.trim()) showInputError()
})

elements.previousButton.addEventListener('click', () => {
  if (activeSearch.page <= 1) return
  navigateToSearch(activeSearch.query, activeSearch.page - 1)
  elements.resultsHeading.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

elements.nextButton.addEventListener('click', () => {
  const totalPages = Math.ceil(activeSearch.totalResults / PAGE_SIZE)
  if (activeSearch.page >= totalPages) return
  navigateToSearch(activeSearch.query, activeSearch.page + 1)
  elements.resultsHeading.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

window.addEventListener('popstate', () => {
  const state = readSearchState()
  elements.input.value = state.query
  showInputError()

  if (state.query) {
    void loadSearch(state)
  } else {
    activeRequest?.abort()
    activeSearch = { query: '', page: 1, totalResults: 0 }
    setLoading(false)
    clearResults()
    statusMessage.show('initial')
  }
})

window.addEventListener('offline', () => {
  activeRequest?.abort()
  setLoading(false)
  clearResults()
  statusMessage.show('offline')
})

window.addEventListener('online', () => {
  if (activeSearch.query && !elements.status.hidden) {
    void loadSearch(activeSearch)
  }
})

const initialState = readSearchState()
if (initialState.query) {
  elements.input.value = initialState.query
  navigateToSearch(initialState.query, initialState.page, { replace: true })
}
