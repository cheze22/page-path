export const STORAGE_KEY = 'pagePathData'
export const STORAGE_VERSION = 1
export const SHELVES = ['want-to-read', 'reading', 'finished']

export function createDefaultData() {
  return { version: STORAGE_VERSION, savedBooks: [], preferences: {} }
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function cleanSavedBook(item) {
  if (!item || typeof item !== 'object' || !item.book || typeof item.book !== 'object') return null
  const shelf = SHELVES.includes(item.shelf) ? item.shelf : 'want-to-read'
  const rating = Number(item.rating)
  return {
    key: typeof item.key === 'string' && item.key ? item.key : bookStorageKey(item.book),
    book: item.book,
    shelf,
    progress: item.progress && typeof item.progress === 'object' ? item.progress : {},
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
    note: typeof item.note === 'string' ? item.note.slice(0, 500) : '',
    addedAt: typeof item.addedAt === 'string' ? item.addedAt : new Date(0).toISOString(),
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date(0).toISOString(),
  }
}

export function parseStoredData(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return createDefaultData()
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return createDefaultData()
  }
  if (!parsed || typeof parsed !== 'object') return createDefaultData()

  const version = Number(parsed.version)
  if (!Number.isInteger(version) || version < 0 || version > STORAGE_VERSION) {
    return createDefaultData()
  }

  // Version 0 had the same saved-book collection without explicit preferences.
  const savedBooks = safeArray(parsed.savedBooks).map(cleanSavedBook).filter(Boolean)
  return {
    version: STORAGE_VERSION,
    savedBooks,
    preferences:
      parsed.preferences &&
      typeof parsed.preferences === 'object' &&
      !Array.isArray(parsed.preferences)
        ? parsed.preferences
        : {},
  }
}

function normalized(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function bookStorageKey(book = {}) {
  const isbn = book.isbn
    ?.find(Boolean)
    ?.replace(/[^0-9X]/gi, '')
    .toUpperCase()
  if (isbn) return `isbn-${isbn}`
  const sourceIds = book.sourceIds || {}
  if (sourceIds.openLibrary) return `open-library-${normalized(sourceIds.openLibrary)}`
  if (sourceIds.gutendex) return `gutenberg-${sourceIds.gutendex}`
  return `book-${normalized(book.title)}-${normalized(book.authors?.[0] || 'unknown')}`
}

export function createStorageService(storage = globalThis.localStorage) {
  function load() {
    try {
      return parseStoredData(storage?.getItem(STORAGE_KEY))
    } catch {
      return createDefaultData()
    }
  }

  function save(data) {
    const safeData = parseStoredData(JSON.stringify({ ...data, version: STORAGE_VERSION }))
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(safeData))
      return { ok: true, data: safeData }
    } catch {
      return { ok: false, data: safeData }
    }
  }

  function saveBook(book, shelf = 'want-to-read') {
    const data = load()
    const key = bookStorageKey(book)
    const now = new Date().toISOString()
    const existingIndex = data.savedBooks.findIndex((item) => item.key === key)
    const safeShelf = SHELVES.includes(shelf) ? shelf : 'want-to-read'
    if (existingIndex >= 0) {
      data.savedBooks[existingIndex] = {
        ...data.savedBooks[existingIndex],
        book: { ...data.savedBooks[existingIndex].book, ...book },
        shelf: safeShelf,
        updatedAt: now,
      }
    } else {
      data.savedBooks.push({
        key,
        book,
        shelf: safeShelf,
        progress: {},
        rating: null,
        note: '',
        addedAt: now,
        updatedAt: now,
      })
    }
    return save(data)
  }

  function updateBook(key, updates = {}) {
    const data = load()
    const index = data.savedBooks.findIndex((item) => item.key === key)
    if (index < 0) return { ok: false, data, reason: 'not-found' }
    const allowed = {}
    if (SHELVES.includes(updates.shelf)) allowed.shelf = updates.shelf
    if (updates.progress && typeof updates.progress === 'object')
      allowed.progress = updates.progress
    const rating = Number(updates.rating)
    if (updates.rating === null || (Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
      allowed.rating = updates.rating === null ? null : rating
    }
    if (typeof updates.note === 'string' && updates.note.length <= 500) allowed.note = updates.note
    data.savedBooks[index] = {
      ...data.savedBooks[index],
      ...allowed,
      updatedAt: new Date().toISOString(),
    }
    return save(data)
  }

  function removeBook(key) {
    const data = load()
    const nextBooks = data.savedBooks.filter((item) => item.key !== key)
    if (nextBooks.length === data.savedBooks.length) return { ok: false, data, reason: 'not-found' }
    data.savedBooks = nextBooks
    return save(data)
  }

  function updatePreferences(preferences) {
    const data = load()
    data.preferences = { ...data.preferences, ...preferences }
    return save(data)
  }

  return { load, saveBook, updateBook, removeBook, updatePreferences }
}
