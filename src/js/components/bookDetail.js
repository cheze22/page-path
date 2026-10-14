import { createCover, languageText } from './bookCard.js'

const FORMAT_LABELS = {
  'text/html': 'Read in browser (HTML)',
  'application/epub+zip': 'Download EPUB',
  'text/plain': 'Read plain text',
  'application/x-mobipocket-ebook': 'Download Kindle-compatible file',
}

function textList(values, limit = 8) {
  if (!values?.length) return 'Unavailable'
  const visible = values.slice(0, limit)
  return `${visible.join(', ')}${values.length > limit ? ` +${values.length - limit} more` : ''}`
}

function formatLabel(format) {
  const baseType = format.mimeType.split(';')[0]
  return FORMAT_LABELS[baseType] || null
}

function metaItem(label, value) {
  const wrapper = document.createElement('div')
  const term = document.createElement('dt')
  const description = document.createElement('dd')
  term.textContent = label
  description.textContent = value
  wrapper.append(term, description)
  return wrapper
}

export function renderBookDetail(container, book, { savedItem, onClose, onShelfChange } = {}) {
  const article = document.createElement('article')
  const closeButton = document.createElement('button')
  const content = document.createElement('div')
  const heading = document.createElement('div')
  const eyebrow = document.createElement('p')
  const title = document.createElement('h2')
  const author = document.createElement('p')
  const metadata = document.createElement('dl')
  const subjects = document.createElement('p')
  const linksHeading = document.createElement('h3')
  const sourceLinks = document.createElement('div')
  const formatHeading = document.createElement('h3')
  const formatLinks = document.createElement('div')
  const shelfLabel = document.createElement('label')
  const shelfSelect = document.createElement('select')

  article.className = 'detail-layout'
  closeButton.className = 'dialog-close'
  closeButton.type = 'button'
  closeButton.textContent = 'Close'
  closeButton.setAttribute('aria-label', 'Close book details')
  closeButton.addEventListener('click', onClose)
  content.className = 'detail-content'
  heading.className = 'detail-heading'
  eyebrow.className = 'section-kicker'
  eyebrow.textContent = (book.sources || [book.source]).join(' + ')
  title.id = 'detailTitle'
  title.textContent = book.title
  author.className = 'detail-author'
  author.textContent = book.authors?.length ? `by ${book.authors.join(', ')}` : 'Author unavailable'
  heading.append(eyebrow, title, author)

  metadata.className = 'detail-metadata'
  metadata.append(
    metaItem('First published', book.firstPublishYear?.toString() || 'Unavailable'),
    metaItem('Languages', languageText(book.languages)),
    metaItem('Edition count', book.editionCount?.toLocaleString() || 'Unavailable'),
    metaItem('Downloads', book.downloadCount?.toLocaleString() || 'Unavailable'),
    metaItem('Rights', book.isPublicDomain ? 'Public domain' : 'See source for rights'),
  )

  subjects.className = 'detail-subjects'
  subjects.innerHTML = '<strong>Subjects and bookshelves:</strong> '
  subjects.append(
    document.createTextNode(textList([...(book.subjects || []), ...(book.bookshelves || [])])),
  )

  shelfLabel.className = 'detail-shelf-label'
  shelfLabel.htmlFor = 'detailShelf'
  shelfLabel.textContent = 'Save to shelf'
  shelfSelect.id = 'detailShelf'
  ;[
    ['', 'Not saved'],
    ['want-to-read', 'Want to Read'],
    ['reading', 'Reading'],
    ['finished', 'Finished'],
  ].forEach(([value, label]) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    shelfSelect.append(option)
  })
  shelfSelect.value = savedItem?.shelf || ''
  shelfSelect.addEventListener('change', () => onShelfChange?.(book, shelfSelect.value))

  linksHeading.textContent = 'Book sources'
  sourceLinks.className = 'link-list'
  ;(book.sourceLinks || []).forEach((link) => {
    const anchor = document.createElement('a')
    anchor.href = link.url
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    anchor.textContent = `${link.source} (opens in a new tab)`
    sourceLinks.append(anchor)
  })

  const readableFormats = (book.formats || []).filter((format) => formatLabel(format))
  formatHeading.textContent = 'Legal ebook formats'
  formatLinks.className = 'link-list format-links'
  readableFormats.forEach((format) => {
    const anchor = document.createElement('a')
    anchor.href = format.url
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    anchor.textContent = `${formatLabel(format)} (opens in a new tab)`
    formatLinks.append(anchor)
  })
  if (!readableFormats.length) {
    const unavailable = document.createElement('p')
    unavailable.className = 'metadata-missing'
    unavailable.textContent = 'No legal ebook format is available in this record.'
    formatLinks.append(unavailable)
  }

  content.append(
    heading,
    metadata,
    subjects,
    shelfLabel,
    shelfSelect,
    linksHeading,
    sourceLinks,
    formatHeading,
    formatLinks,
  )
  article.append(closeButton, createCover(book, 'detail-cover'), content)
  container.replaceChildren(article)
}
