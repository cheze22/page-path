import { createCover } from './bookCard.js'
import { calculateProgress } from '../services/progressService.js'

const SHELF_LABELS = {
  'want-to-read': 'Want to Read',
  reading: 'Reading',
  finished: 'Finished',
}

function option(value, label) {
  const element = document.createElement('option')
  element.value = value
  element.textContent = label
  return element
}

function emptyMessage(message) {
  const element = document.createElement('p')
  element.className = 'empty-shelf'
  element.textContent = message
  return element
}

function shelfControl(item, onUpdate) {
  const wrapper = document.createElement('div')
  const label = document.createElement('label')
  const select = document.createElement('select')
  const id = `shelf-${item.key}`
  wrapper.className = 'control-group'
  label.htmlFor = id
  label.textContent = 'Shelf'
  select.id = id
  Object.entries(SHELF_LABELS).forEach(([value, text]) => select.append(option(value, text)))
  select.value = item.shelf
  select.addEventListener('change', () => onUpdate(item.key, { shelf: select.value }))
  wrapper.append(label, select)
  return wrapper
}

function ratingControl(item, onUpdate) {
  const wrapper = document.createElement('div')
  const label = document.createElement('label')
  const select = document.createElement('select')
  const id = `rating-${item.key}`
  wrapper.className = 'control-group'
  label.htmlFor = id
  label.textContent = 'Your rating'
  select.id = id
  select.append(option('', 'Not rated'))
  for (let rating = 1; rating <= 5; rating += 1) {
    select.append(option(String(rating), `${rating} out of 5`))
  }
  select.value = item.rating?.toString() || ''
  select.addEventListener('change', () => {
    onUpdate(item.key, { rating: select.value ? Number(select.value) : null })
  })
  wrapper.append(label, select)
  return wrapper
}

function noteControl(item, onUpdate) {
  const wrapper = document.createElement('div')
  const label = document.createElement('label')
  const textarea = document.createElement('textarea')
  const help = document.createElement('p')
  const button = document.createElement('button')
  const id = `note-${item.key}`
  wrapper.className = 'note-control'
  label.htmlFor = id
  label.textContent = 'Personal note'
  textarea.id = id
  textarea.maxLength = 500
  textarea.rows = 3
  textarea.value = item.note || ''
  textarea.placeholder = 'Add a short note (500 characters maximum)'
  help.className = 'field-feedback'
  help.id = `${id}-feedback`
  help.textContent = `${textarea.value.length}/500 characters`
  textarea.setAttribute('aria-describedby', help.id)
  textarea.addEventListener('input', () => {
    help.textContent = `${textarea.value.length}/500 characters`
  })
  button.className = 'secondary-button compact-button'
  button.type = 'button'
  button.textContent = 'Save note'
  button.addEventListener('click', () => {
    if (textarea.value.length > 500) {
      help.textContent = 'Keep your note to 500 characters or fewer.'
      return
    }
    onUpdate(item.key, { note: textarea.value.trim() })
    help.textContent = 'Note saved.'
  })
  wrapper.append(label, textarea, help, button)
  return wrapper
}

function savedBookCard(item, handlers) {
  const article = document.createElement('article')
  const content = document.createElement('div')
  const title = document.createElement('h3')
  const author = document.createElement('p')
  const controls = document.createElement('div')
  const buttons = document.createElement('div')
  const details = document.createElement('button')
  const remove = document.createElement('button')
  article.className = 'saved-book-card'
  content.className = 'saved-book-content'
  title.textContent = item.book.title
  author.className = 'book-author'
  author.textContent = item.book.authors?.length
    ? `by ${item.book.authors.join(', ')}`
    : 'Author unavailable'
  controls.className = 'saved-controls'
  controls.append(shelfControl(item, handlers.onUpdate), ratingControl(item, handlers.onUpdate))
  buttons.className = 'book-actions'
  details.className = 'secondary-button compact-button'
  details.type = 'button'
  details.textContent = 'View details'
  details.addEventListener('click', () => handlers.onDetails(item.book))
  remove.className = 'text-button danger-button'
  remove.type = 'button'
  remove.textContent = 'Remove'
  remove.setAttribute('aria-label', `Remove ${item.book.title} from your library`)
  remove.addEventListener('click', () => handlers.onRemove(item.key))
  buttons.append(details, remove)
  content.append(title, author, controls, noteControl(item, handlers.onUpdate), buttons)
  article.append(createCover(item.book), content)
  return article
}

export function renderLibrary(container, savedBooks, handlers) {
  const fragment = document.createDocumentFragment()
  Object.entries(SHELF_LABELS).forEach(([shelf, label]) => {
    const section = document.createElement('section')
    const heading = document.createElement('h2')
    const grid = document.createElement('div')
    const books = savedBooks.filter((item) => item.shelf === shelf)
    section.className = 'library-shelf'
    heading.textContent = `${label} (${books.length})`
    grid.className = 'saved-books-grid'
    if (books.length) {
      books.forEach((item) => grid.append(savedBookCard(item, handlers)))
    } else {
      grid.append(emptyMessage(`No books on your ${label} shelf yet.`))
    }
    section.append(heading, grid)
    fragment.append(section)
  })
  container.replaceChildren(fragment)
}

function progressForm(item, onUpdate) {
  const form = document.createElement('form')
  const title = document.createElement('h2')
  const fields = document.createElement('div')
  const feedback = document.createElement('div')
  const currentId = `current-${item.key}`
  const totalId = `total-${item.key}`
  const targetId = `target-${item.key}`
  const progress = item.progress || {}

  form.className = 'progress-card'
  form.noValidate = true
  title.textContent = item.book.title
  fields.className = 'progress-fields'
  feedback.className = 'progress-feedback'
  feedback.id = `progress-feedback-${item.key}`
  feedback.setAttribute('aria-live', 'polite')

  const definitions = [
    [currentId, 'Current page', 'number', progress.currentPage ?? 0],
    [totalId, 'Total pages', 'number', progress.totalPages ?? ''],
    [targetId, 'Target finish date', 'date', progress.targetDate ?? ''],
  ]
  definitions.forEach(([id, labelText, type, value]) => {
    const wrapper = document.createElement('div')
    const label = document.createElement('label')
    const input = document.createElement('input')
    label.htmlFor = id
    label.textContent = labelText
    input.id = id
    input.name = id.split('-')[0]
    input.type = type
    input.value = value
    if (type === 'number') {
      input.min = labelText === 'Total pages' ? '1' : '0'
      input.step = '1'
      input.inputMode = 'numeric'
    }
    wrapper.append(label, input)
    fields.append(wrapper)
  })

  const daysFieldset = document.createElement('fieldset')
  const legend = document.createElement('legend')
  legend.textContent = 'Preferred reading days (optional)'
  daysFieldset.className = 'day-picker'
  daysFieldset.append(legend)
  ;['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((day, index) => {
    const label = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.name = 'preferredDays'
    input.value = String(index)
    input.checked = progress.preferredDays?.map(Number).includes(index) || false
    label.append(input, document.createTextNode(day))
    daysFieldset.append(label)
  })

  const button = document.createElement('button')
  button.className = 'primary-button'
  button.type = 'submit'
  button.textContent = 'Save progress'
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const formData = new FormData(form)
    const nextProgress = {
      currentPage: Number(formData.get('current')),
      totalPages: Number(formData.get('total')),
      targetDate: String(formData.get('target') || ''),
      preferredDays: formData.getAll('preferredDays').map(Number),
    }
    const result = calculateProgress(nextProgress)
    if (!result.valid) {
      feedback.className = 'progress-feedback error-text'
      feedback.textContent = result.errors.join(' ')
      return
    }
    onUpdate(item.key, { progress: nextProgress })
    feedback.className = 'progress-feedback success-text'
    feedback.textContent = `Saved: ${result.completionPercentage}% complete, ${result.remainingPages} pages remaining${result.pagesPerReadingDay === null ? '.' : `, about ${result.pagesPerReadingDay} pages per reading day.`}`
  })

  const existingResult = calculateProgress(progress)
  if (existingResult.valid && progress.totalPages) {
    feedback.textContent = `${existingResult.completionPercentage}% complete · ${existingResult.remainingPages} pages remaining${existingResult.pagesPerReadingDay === null ? '' : ` · ${existingResult.pagesPerReadingDay} pages per reading day`}`
  } else {
    feedback.textContent = 'Enter the book’s page count to start tracking.'
  }

  form.append(title, fields, daysFieldset, feedback, button)
  return form
}

export function renderReadingGoals(container, savedBooks, onUpdate) {
  const readingBooks = savedBooks.filter((item) => item.shelf === 'reading')
  if (!readingBooks.length) {
    container.replaceChildren(
      emptyMessage('Move a saved book to the Reading shelf to track its progress here.'),
    )
    return
  }
  container.replaceChildren(...readingBooks.map((item) => progressForm(item, onUpdate)))
}
