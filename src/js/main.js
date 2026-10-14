import '../css/base.css'
import '../css/components.css'
import '../css/responsive.css'

import { createBookCard } from './components/bookCard.js'
import { renderBookDetail } from './components/bookDetail.js'
import { renderLibrary, renderReadingGoals } from './components/libraryView.js'
import { createStatusController } from './components/statusMessage.js'
import { applyFiltersAndSort, DEFAULT_FILTERS } from './services/filterService.js'
import { searchAllSources } from './services/searchService.js'
import { bookStorageKey, createStorageService } from './services/storageService.js'
import { createSearchUrl, readSearchState } from './utils/searchUrl.js'

const PAGE_SIZE = 12
const storage = createStorageService()

const elements = {
  form: document.querySelector('#searchForm'),
  input: document.querySelector('#searchInput'),
  inputError: document.querySelector('#searchError'),
  grid: document.querySelector('#resultsGrid'),
  status: document.querySelector('#statusMessage'),
  resultCount: document.querySelector('#resultCount'),
  sourceStatus: document.querySelector('#sourceStatus'),
  pagination: document.querySelector('#pagination'),
  previousButton: document.querySelector('#previousPage'),
  nextButton: document.querySelector('#nextPage'),
  pageIndicator: document.querySelector('#pageIndicator'),
  resultsHeading: document.querySelector('#resultsHeading'),
  filterForm: document.querySelector('#filterForm'),
  languageFilter: document.querySelector('#languageFilter'),
  clearFilters: document.querySelector('#clearFilters'),
  sortSelect: document.querySelector('#sortSelect'),
  appNotice: document.querySelector('#appNotice'),
  dialog: document.querySelector('#bookDialog'),
  detail: document.querySelector('#bookDetail'),
  library: document.querySelector('#libraryShelves'),
  goals: document.querySelector('#readingGoals'),
}

const statusMessage = createStatusController(elements.status)
let activeSearch = { query: '', page: 1, totalResults: 0, hasNextPage: false }
let currentBooks = []
let activeRequest = null
let filters = { ...DEFAULT_FILTERS }

function formatResultCount(visible, total) {
  const visibleText = `${visible.toLocaleString()} ${visible === 1 ? 'book' : 'books'}`
  return total > visible
    ? `${visibleText} on this page · ${total.toLocaleString()} source matches`
    : visibleText
}

function clearResults() {
  elements.grid.replaceChildren()
  elements.resultCount.textContent = ''
  elements.sourceStatus.textContent = ''
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

function showNotice(message, type = 'success') {
  elements.appNotice.textContent = message
  elements.appNotice.className = `app-notice ${type}`
  elements.appNotice.hidden = false
  window.setTimeout(() => {
    elements.appNotice.hidden = true
  }, 3500)
}

function getSavedItem(book) {
  const key = bookStorageKey(book)
  return storage.load().savedBooks.find((item) => item.key === key)
}

function saveBook(book, shelf = 'want-to-read') {
  const result = storage.saveBook(book, shelf)
  showNotice(
    result.ok
      ? `${book.title} was saved to your library.`
      : 'Your browser could not save this book.',
    result.ok ? 'success' : 'error',
  )
  renderCurrentResults()
  renderPersonalViews()
  return result
}

function updateSavedBook(key, updates) {
  const result = storage.updateBook(key, updates)
  showNotice(
    result.ok ? 'Your library was updated.' : 'That change could not be saved.',
    result.ok ? 'success' : 'error',
  )
  renderPersonalViews()
  return result
}

function removeSavedBook(key) {
  const result = storage.removeBook(key)
  showNotice(
    result.ok ? 'The book was removed from your library.' : 'That book is no longer saved.',
    result.ok ? 'success' : 'error',
  )
  renderCurrentResults()
  renderPersonalViews()
}

function openBookDetail(book) {
  const savedItem = getSavedItem(book)
  renderBookDetail(elements.detail, book, {
    savedItem,
    onClose: () => elements.dialog.close(),
    onShelfChange: (selectedBook, shelf) => {
      const existing = getSavedItem(selectedBook)
      if (!shelf && existing) {
        removeSavedBook(existing.key)
      } else if (existing) {
        updateSavedBook(existing.key, { shelf })
      } else if (shelf) {
        saveBook(selectedBook, shelf)
      }
    },
  })
  elements.dialog.showModal()
}

function renderCurrentResults() {
  if (!currentBooks.length) return
  const displayed = applyFiltersAndSort(currentBooks, filters)
  const fragment = document.createDocumentFragment()
  displayed.forEach((book) => {
    fragment.append(
      createBookCard(book, {
        onDetails: openBookDetail,
        onSave: (selectedBook) => saveBook(selectedBook),
        isSaved: Boolean(getSavedItem(book)),
      }),
    )
  })
  elements.grid.replaceChildren(fragment)
  elements.resultCount.textContent = formatResultCount(displayed.length, activeSearch.totalResults)

  if (!displayed.length) {
    statusMessage.show('filtered')
  } else {
    statusMessage.hide()
  }
}

function updatePagination(page, hasNextPage) {
  elements.previousButton.disabled = page <= 1
  elements.nextButton.disabled = !hasNextPage
  elements.pageIndicator.textContent = `Page ${page}`
  elements.pagination.hidden = false
}

function populateLanguageFilter(books) {
  const selected = elements.languageFilter.value
  const languages = [...new Set(books.flatMap((book) => book.languages || []))].sort()
  elements.languageFilter.replaceChildren()
  const all = document.createElement('option')
  all.value = ''
  all.textContent = 'All languages'
  elements.languageFilter.append(all)
  languages.forEach((language) => {
    const item = document.createElement('option')
    item.value = language
    item.textContent = language.toUpperCase()
    elements.languageFilter.append(item)
  })
  elements.languageFilter.value = languages.includes(selected) ? selected : ''
  if (!elements.languageFilter.value) filters.language = ''
}

function showSearchFailure() {
  clearResults()
  if (!navigator.onLine) {
    statusMessage.show('offline')
    return
  }
  statusMessage.show('error', {
    message:
      'Open Library and Project Gutenberg could not be reached. Please try again in a moment.',
  })
}

async function loadSearch({ query, page }) {
  activeRequest?.abort()
  const requestController = new AbortController()
  activeRequest = requestController
  activeSearch = { query, page, totalResults: 0, hasNextPage: false }
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
    const response = await searchAllSources({
      query,
      page,
      limit: PAGE_SIZE,
      signal: requestController.signal,
    })
    currentBooks = response.books
    activeSearch = {
      query,
      page,
      totalResults: response.totalResults,
      hasNextPage: response.hasNextPage,
    }
    populateLanguageFilter(currentBooks)
    elements.sourceStatus.textContent = response.partial
      ? `Partial results: ${response.unavailableSources.join(' and ')} is unavailable. Showing ${response.availableSources.join(' and ')}.`
      : 'Results include Open Library and Project Gutenberg.'

    if (!currentBooks.length) {
      clearResults()
      statusMessage.show('empty')
      return
    }

    renderCurrentResults()
    updatePagination(page, response.hasNextPage)
  } catch (error) {
    if (error?.name !== 'AbortError') showSearchFailure()
  } finally {
    if (activeRequest === requestController && !requestController.signal.aborted) setLoading(false)
  }
}

function navigateToSearch(query, page, { replace = false } = {}) {
  const nextUrl = new URL(createSearchUrl(query, page), window.location.origin)
  nextUrl.hash = 'discover'
  window.history[replace ? 'replaceState' : 'pushState'](
    { query, page },
    '',
    `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
  )
  showView('discover')
  void loadSearch({ query, page })
}

function renderPersonalViews() {
  const savedBooks = storage.load().savedBooks
  renderLibrary(elements.library, savedBooks, {
    onUpdate: updateSavedBook,
    onRemove: removeSavedBook,
    onDetails: openBookDetail,
  })
  renderReadingGoals(elements.goals, savedBooks, updateSavedBook)
}

function showView(requestedView) {
  const view = ['discover', 'library', 'goal'].includes(requestedView) ? requestedView : 'discover'
  document.querySelectorAll('[data-view]').forEach((element) => {
    element.hidden = element.dataset.view !== view
  })
  document.querySelectorAll('[data-view-link]').forEach((link) => {
    const active = link.dataset.viewLink === view
    link.classList.toggle('active', active)
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })
  if (view !== 'discover') renderPersonalViews()
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

elements.filterForm.addEventListener('input', () => {
  const data = new FormData(elements.filterForm)
  filters = {
    ...filters,
    language: String(data.get('language') || ''),
    topic: String(data.get('topic') || ''),
    yearFrom: String(data.get('yearFrom') || ''),
    yearTo: String(data.get('yearTo') || ''),
    source: String(data.get('source') || ''),
    freeEbook: data.get('freeEbook') === 'on',
  }
  renderCurrentResults()
})

elements.sortSelect.addEventListener('change', () => {
  filters.sort = elements.sortSelect.value
  renderCurrentResults()
})

elements.clearFilters.addEventListener('click', () => {
  elements.filterForm.reset()
  elements.sortSelect.value = 'relevance'
  filters = { ...DEFAULT_FILTERS }
  renderCurrentResults()
})

elements.previousButton.addEventListener('click', () => {
  if (activeSearch.page <= 1) return
  navigateToSearch(activeSearch.query, activeSearch.page - 1)
  elements.resultsHeading.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

elements.nextButton.addEventListener('click', () => {
  if (!activeSearch.hasNextPage) return
  navigateToSearch(activeSearch.query, activeSearch.page + 1)
  elements.resultsHeading.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

elements.dialog.addEventListener('click', (event) => {
  if (event.target === elements.dialog) elements.dialog.close()
})

window.addEventListener('popstate', () => {
  const state = readSearchState()
  showView(window.location.hash.slice(1))
  if (state.query && (state.query !== activeSearch.query || state.page !== activeSearch.page)) {
    void loadSearch(state)
  }
})

window.addEventListener('hashchange', () => showView(window.location.hash.slice(1)))

window.addEventListener('offline', () => {
  activeRequest?.abort()
  setLoading(false)
  clearResults()
  statusMessage.show('offline')
})

window.addEventListener('online', () => {
  if (activeSearch.query && !elements.status.hidden) void loadSearch(activeSearch)
})

renderPersonalViews()
showView(window.location.hash.slice(1))
const initialState = readSearchState()
if (initialState.query) {
  elements.input.value = initialState.query
  navigateToSearch(initialState.query, initialState.page, { replace: true })
}
