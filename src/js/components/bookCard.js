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

function createFallbackCover(book) {
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

function createCover(book) {
  if (!book.coverId) return createFallbackCover(book)

  const wrapper = document.createElement('div')
  const image = document.createElement('img')
  const authorText = book.authors.length ? ` by ${book.authors.join(', ')}` : ''

  wrapper.className = 'book-cover'
  image.src = `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`
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

function languageText(languages) {
  if (!languages.length) return 'Unavailable'

  const names = languages
    .slice(0, 2)
    .map((code) => LANGUAGE_NAMES[code.toLowerCase()] || code.toUpperCase())
  const extraCount = languages.length - names.length
  return extraCount > 0 ? `${names.join(', ')} +${extraCount}` : names.join(', ')
}

function openLibraryUrl(id) {
  return id.startsWith('/') ? `https://openlibrary.org${id}` : 'https://openlibrary.org/'
}

export function createBookCard(book) {
  const article = document.createElement('article')
  const content = document.createElement('div')
  const title = document.createElement('h3')
  const titleLink = document.createElement('a')
  const author = document.createElement('p')
  const metadata = document.createElement('dl')

  article.className = 'book-card'
  content.className = 'book-card-content'
  title.className = 'book-title'
  titleLink.href = openLibraryUrl(book.id)
  titleLink.target = '_blank'
  titleLink.rel = 'noreferrer'
  titleLink.textContent = book.title
  titleLink.setAttribute('aria-label', `${book.title} on Open Library (opens in a new tab)`)
  title.append(titleLink)

  author.className = book.authors.length ? 'book-author' : 'book-author metadata-missing'
  author.textContent = book.authors.length ? `by ${book.authors.join(', ')}` : 'Author unavailable'

  metadata.className = 'book-metadata'
  metadata.append(
    createMetaItem('First published', book.firstPublishYear?.toString() || 'Unavailable'),
    createMetaItem('Editions', book.editionCount?.toLocaleString() || 'Unavailable'),
    createMetaItem('Language', languageText(book.languages)),
  )

  content.append(title, author, metadata)
  article.append(createCover(book), content)
  return article
}
