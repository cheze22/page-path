const LANGUAGE_NAMES = {
  eng: 'English',
  spa: 'Spanish',
  fre: 'French',
  fra: 'French',
  ger: 'German',
  deu: 'German',
  ita: 'Italian',
  por: 'Portuguese',
  rus: 'Russian',
  jpn: 'Japanese',
  chi: 'Chinese',
  zho: 'Chinese',
}

export function languageText(languages = []) {
  if (!languages.length) return 'Unavailable'

  const names = languages
    .slice(0, 2)
    .map((code) => LANGUAGE_NAMES[code.toLowerCase()] || code.toUpperCase())
  const extraCount = languages.length - names.length
  return extraCount > 0 ? `${names.join(', ')} +${extraCount}` : names.join(', ')
}

export function createFallbackCover(book) {
  const fallback = document.createElement('div')
  const initial = document.createElement('span')

  fallback.className = 'book-cover fallback-cover'
  fallback.setAttribute('role', 'img')
  fallback.setAttribute('aria-label', `No cover available for ${book.title}`)
  initial.setAttribute('aria-hidden', 'true')
  initial.textContent =
    book.title === 'Title unavailable' ? '?' : book.title.charAt(0).toUpperCase()
  fallback.append(initial)
  return fallback
}

export function createCover(book, className = '') {
  const coverUrl =
    book.coverImage ||
    (book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg` : '')
  if (!coverUrl) return createFallbackCover(book)

  const wrapper = document.createElement('div')
  const image = document.createElement('img')
  const authorText = book.authors.length ? ` by ${book.authors.join(', ')}` : ''

  wrapper.className = `book-cover ${className}`.trim()
  image.src = coverUrl
  image.alt = `Cover of ${book.title}${authorText}`
  image.loading = 'lazy'
  image.decoding = 'async'
  image.width = 180
  image.height = 270
  image.addEventListener(
    'error',
    () => {
      wrapper.replaceWith(createFallbackCover(book))
    },
    { once: true },
  )
  wrapper.append(image)
  return wrapper
}

function createMetaItem(label, value) {
  const item = document.createElement('div')
  const term = document.createElement('dt')
  const description = document.createElement('dd')

  term.textContent = label
  description.textContent = value
  item.append(term, description)
  return item
}

export function createBookCard(book, { onDetails, onSave, isSaved = false } = {}) {
  const article = document.createElement('article')
  const content = document.createElement('div')
  const title = document.createElement('h3')
  const author = document.createElement('p')
  const metadata = document.createElement('dl')
  const source = document.createElement('p')
  const actions = document.createElement('div')
  const detailsButton = document.createElement('button')
  const saveButton = document.createElement('button')

  article.className = 'book-card'
  content.className = 'book-card-content'
  title.className = 'book-title'
  title.textContent = book.title

  author.className = book.authors.length ? 'book-author' : 'book-author metadata-missing'
  author.textContent = book.authors.length ? `by ${book.authors.join(', ')}` : 'Author unavailable'

  metadata.className = 'book-metadata'
  metadata.append(
    createMetaItem('First published', book.firstPublishYear?.toString() || 'Unavailable'),
    createMetaItem('Editions', book.editionCount?.toLocaleString() || 'Unavailable'),
    createMetaItem('Language', languageText(book.languages)),
  )

  source.className = 'source-chip'
  source.textContent = (book.sources || [book.source]).join(' + ')
  actions.className = 'book-actions'
  detailsButton.className = 'secondary-button compact-button'
  detailsButton.type = 'button'
  detailsButton.textContent = 'View details'
  detailsButton.setAttribute('aria-label', `View details for ${book.title}`)
  detailsButton.addEventListener('click', () => onDetails?.(book))
  saveButton.className = 'primary-button compact-button'
  saveButton.type = 'button'
  saveButton.textContent = isSaved ? 'Saved' : 'Save book'
  saveButton.disabled = isSaved
  saveButton.setAttribute('aria-label', isSaved ? `${book.title} is saved` : `Save ${book.title}`)
  saveButton.addEventListener('click', () => onSave?.(book, saveButton))
  actions.append(detailsButton, saveButton)

  content.append(source, title, author, metadata, actions)
  article.append(createCover(book), content)
  return article
}
