import assert from 'node:assert/strict'
import test from 'node:test'

import { GutendexError, searchGutendex } from '../src/js/api/gutendexApi.js'
import { normalizeBook, normalizeGutendexBook } from '../src/js/services/bookNormalizer.js'
import { filterBooks, sortBooks } from '../src/js/services/filterService.js'
import { calculateProgress } from '../src/js/services/progressService.js'
import { deduplicateBooks, searchAllSources } from '../src/js/services/searchService.js'
import {
  createStorageService,
  parseStoredData,
  STORAGE_KEY,
} from '../src/js/services/storageService.js'

const gutenbergRecord = {
  id: 1342,
  title: 'Pride and Prejudice',
  authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
  languages: ['en'],
  subjects: ['Courtship -- Fiction'],
  bookshelves: ['Best Books Ever Listings'],
  copyright: false,
  formats: {
    'text/html': 'https://www.gutenberg.org/ebooks/1342.html.images',
    'application/epub+zip': 'https://www.gutenberg.org/ebooks/1342.epub3.images',
    'image/jpeg': 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
  },
  download_count: 72000,
}

test('Gutendex client builds optional parameters and parses pagination metadata', async () => {
  let requestUrl = ''
  const response = await searchGutendex({
    query: ' Pride ',
    page: 2,
    language: ['en', 'fr'],
    topic: 'fiction',
    fetchImpl: async (url) => {
      requestUrl = url
      return {
        ok: true,
        json: async () => ({
          count: 33,
          next: 'https://gutendex.com/books/?page=3',
          previous: 'x',
          results: [gutenbergRecord],
        }),
      }
    },
  })
  const params = new URL(requestUrl).searchParams
  assert.equal(params.get('search'), 'Pride')
  assert.equal(params.get('page'), '2')
  assert.equal(params.get('languages'), 'en,fr')
  assert.equal(params.get('topic'), 'fiction')
  assert.equal(response.totalResults, 33)
  assert.match(response.next, /page=3/)
})

test('Gutendex client safely rejects malformed and HTTP responses', async () => {
  await assert.rejects(
    searchGutendex({
      query: 'book',
      fetchImpl: async () => ({ ok: true, json: async () => ({ books: [] }) }),
    }),
    (error) => error instanceof GutendexError && error.kind === 'api',
  )
  await assert.rejects(
    searchGutendex({ query: 'book', fetchImpl: async () => ({ ok: false, status: 503 }) }),
    (error) => error instanceof GutendexError && error.status === 503,
  )
})

test('Gutendex normalization maps shared fields, authors, formats, and rights', () => {
  const book = normalizeGutendexBook(gutenbergRecord)
  assert.equal(book.id, 'gutenberg-1342')
  assert.equal(book.source, 'Project Gutenberg')
  assert.deepEqual(book.authors, ['Austen, Jane'])
  assert.equal(book.authorDetails[0].birthYear, 1775)
  assert.equal(book.firstPublishYear, null)
  assert.deepEqual(book.languages, ['en'])
  assert.equal(book.formats.length, 3)
  assert.equal(book.downloadCount, 72000)
  assert.equal(book.isPublicDomain, true)
  assert.equal(book.freeEbook, true)
})

test('both normalizers produce the same shared model keys', () => {
  const openLibrary = normalizeBook({ key: '/works/OL1W', title: 'Example' })
  const gutendex = normalizeGutendexBook({ id: 1, title: 'Example' })
  assert.deepEqual(Object.keys(openLibrary).sort(), Object.keys(gutendex).sort())
})

test('combined search returns partial results when one API fails', async () => {
  const result = await searchAllSources({
    query: 'example',
    openLibrarySearch: async () => ({
      records: [{ key: '/works/OL1W', title: 'Example' }],
      totalResults: 1,
    }),
    gutendexSearch: async () => {
      throw new Error('down')
    },
  })
  assert.equal(result.books.length, 1)
  assert.equal(result.partial, true)
  assert.deepEqual(result.availableSources, ['Open Library'])
  assert.deepEqual(result.unavailableSources, ['Project Gutenberg'])
})

test('combined search rejects only when both APIs fail', async () => {
  await assert.rejects(
    searchAllSources({
      query: 'example',
      openLibrarySearch: async () => Promise.reject(new Error('down')),
      gutendexSearch: async () => Promise.reject(new Error('down')),
    }),
    (error) => error.name === 'SearchServiceError',
  )
})

test('deduplication merges matching ISBN records and preserves both sources', () => {
  const first = normalizeBook({
    key: '/works/OL1W',
    title: 'Pride and Prejudice',
    author_name: ['Jane Austen'],
    isbn: ['9780141439518'],
    edition_count: 100,
  })
  const second = {
    ...normalizeGutendexBook(gutenbergRecord),
    isbn: ['978-0-14-143951-8'],
  }
  const [merged] = deduplicateBooks([first, second])
  assert.equal(deduplicateBooks([first, second]).length, 1)
  assert.deepEqual(merged.sources, ['Open Library', 'Project Gutenberg'])
  assert.equal(merged.editionCount, 100)
  assert.equal(merged.downloadCount, 72000)
  assert.equal(merged.sourceLinks.length, 2)
})

test('deduplication does not merge matching titles with different authors', () => {
  const one = normalizeBook({ title: 'Home', author_name: ['Toni Morrison'] })
  const two = normalizeGutendexBook({ id: 2, title: 'Home', authors: [{ name: 'Other Author' }] })
  assert.equal(deduplicateBooks([one, two]).length, 2)
})

test('deduplication merges title and reordered author names only across sources', () => {
  const openLibrary = normalizeBook({ title: 'Pride and Prejudice', author_name: ['Jane Austen'] })
  const gutenbergOne = normalizeGutendexBook(gutenbergRecord)
  const gutenbergTwo = normalizeGutendexBook({ ...gutenbergRecord, id: 42671 })
  const results = deduplicateBooks([openLibrary, gutenbergOne, gutenbergTwo])
  assert.equal(results.length, 2)
  assert.deepEqual(results[0].sources, ['Open Library', 'Project Gutenberg'])
  assert.deepEqual(results[1].sources, ['Project Gutenberg'])
})

test('filters combine language, topic, year, source, and free ebook criteria', () => {
  const books = [
    { ...normalizeGutendexBook(gutenbergRecord), firstPublishYear: 1813 },
    normalizeBook({
      key: '/works/OL2W',
      title: 'Modern',
      author_name: ['Writer'],
      language: ['eng'],
      first_publish_year: 2020,
    }),
  ]
  const result = filterBooks(books, {
    language: 'en',
    topic: 'courtship',
    yearFrom: '1800',
    yearTo: '1900',
    source: 'Project Gutenberg',
    freeEbook: true,
  })
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'gutenberg-1342')
})

test('sorts put missing values last for year, editions, and downloads', () => {
  const books = [
    { id: 'missing', firstPublishYear: null, editionCount: null, downloadCount: null },
    { id: 'small', firstPublishYear: 1900, editionCount: 2, downloadCount: 10 },
    { id: 'large', firstPublishYear: 2000, editionCount: 20, downloadCount: 100 },
  ]
  assert.deepEqual(
    sortBooks(books, 'year').map((book) => book.id),
    ['large', 'small', 'missing'],
  )
  assert.deepEqual(
    sortBooks(books, 'editions').map((book) => book.id),
    ['large', 'small', 'missing'],
  )
  assert.deepEqual(
    sortBooks(books, 'downloads').map((book) => book.id),
    ['large', 'small', 'missing'],
  )
})

test('corrupted or future-version storage data safely returns defaults', () => {
  assert.deepEqual(parseStoredData('{broken'), { version: 1, savedBooks: [], preferences: {} })
  assert.deepEqual(parseStoredData(JSON.stringify({ version: 99, savedBooks: [{ bad: true }] })), {
    version: 1,
    savedBooks: [],
    preferences: {},
  })
})

function memoryStorage(initial = {}) {
  const entries = new Map(Object.entries(initial))
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  }
}

test('storage prevents duplicates and persists shelf, note, rating, and progress updates', () => {
  const backing = memoryStorage()
  const service = createStorageService(backing)
  const book = normalizeGutendexBook(gutenbergRecord)
  service.saveBook(book, 'want-to-read')
  service.saveBook(book, 'reading')
  let data = service.load()
  assert.equal(data.savedBooks.length, 1)
  assert.equal(data.savedBooks[0].shelf, 'reading')
  const key = data.savedBooks[0].key
  service.updateBook(key, {
    note: 'A favorite.',
    rating: 5,
    progress: { currentPage: 100, totalPages: 400, targetDate: '' },
  })
  data = JSON.parse(backing.getItem(STORAGE_KEY))
  assert.equal(data.savedBooks[0].note, 'A favorite.')
  assert.equal(data.savedBooks[0].rating, 5)
  assert.equal(data.savedBooks[0].progress.currentPage, 100)
})

test('progress validation and calculations handle valid and invalid page states', () => {
  const valid = calculateProgress(
    { currentPage: 75, totalPages: 300, targetDate: '2026-10-17', preferredDays: [4, 6] },
    new Date(2026, 9, 14),
  )
  assert.equal(valid.valid, true)
  assert.equal(valid.completionPercentage, 25)
  assert.equal(valid.remainingPages, 225)
  assert.equal(valid.pagesPerReadingDay, 113)

  const invalid = calculateProgress({ currentPage: 301, totalPages: 300, targetDate: 'not-a-date' })
  assert.equal(invalid.valid, false)
  assert.match(invalid.errors.join(' '), /cannot be greater/)
  assert.match(invalid.errors.join(' '), /valid target/)
})
