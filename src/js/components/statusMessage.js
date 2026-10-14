const STATUS_CONTENT = {
  initial: {
    icon: '⌕',
    title: 'Start with a search',
    message: 'Enter a title, author, or subject to explore both book collections.',
  },
  loading: {
    icon: '',
    title: 'Searching the shelves…',
    message: 'Open Library and Project Gutenberg are looking for matching books.',
  },
  empty: {
    icon: '∅',
    title: 'No books found',
    message: 'Try a different title, author, subject, or a broader search.',
  },
  filtered: {
    icon: '≡',
    title: 'No books match these filters',
    message: 'Clear or adjust a filter to see more of this result page.',
  },
  error: {
    icon: '!',
    title: 'Search unavailable',
    message: 'Something went wrong. Please try again in a moment.',
  },
  offline: {
    icon: '⌁',
    title: 'You appear to be offline',
    message: 'Reconnect to the internet, then try your search again.',
  },
}

export function createStatusController(element) {
  if (!(element instanceof HTMLElement)) {
    throw new TypeError('A status message element is required.')
  }

  function show(state, overrides = {}) {
    const content = { ...STATUS_CONTENT[state], ...overrides }
    const icon = document.createElement('span')
    const copy = document.createElement('div')
    const title = document.createElement('h3')
    const message = document.createElement('p')

    icon.className = state === 'loading' ? 'status-icon spinner' : 'status-icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.textContent = content.icon
    title.textContent = content.title
    message.textContent = content.message
    copy.append(title, message)

    element.replaceChildren(icon, copy)
    element.className = `status-message ${state}`
    element.hidden = false
    element.setAttribute('role', state === 'error' || state === 'offline' ? 'alert' : 'status')
  }

  function hide() {
    element.hidden = true
  }

  return { show, hide }
}
