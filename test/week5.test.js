import assert from 'node:assert/strict'
import test from 'node:test'

import { OpenLibraryError, searchBooks } from '../src/js/api/openLibraryApi.js'
import { normalizeBook, normalizeBooks } from '../src/js/services/bookNormalizer.js'
import { createSearchUrl, readSearchState } from '../src/js/utils/searchUrl.js'

test('blank searches fail before fetch is called', async () => {
  let fetchCalled = false
  const fetchImpl = async () => {
    fetchCalled = true
  }

  await assert.rejects(
    searchBooks({ query: '   ', fetchImpl }),
    (error) => error instanceof OpenLibraryError && /Enter a title/.test(error.message),
  )
  assert.equal(fetchCalled, false)
})

test('search request includes its query, page, limit, and selected fields', async () => {
  let requestUrl = ''
  const fetchImpl = async (url) => {
    requestUrl = url
    return {
      ok: true,
      json: async () => ({ numFound: 25, docs: [{ key: '/works/OL1W' }] }),
    }
  }

  const result = await searchBooks({
    query: ' The Hobbit ',
    page: 2,
    limit: 12,
    fields: ['key', 'title'],
    fetchImpl,
  })
  const params = new URL(requestUrl).searchParams

  assert.equal(params.get('q'), 'The Hobbit')
  assert.equal(params.get('page'), '2')
  assert.equal(params.get('limit'), '12')
  assert.equal(params.get('fields'), 'key,title')
  assert.equal(result.totalResults, 25)
})

test('malformed Open Library data produces a handled API error', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ results: [] }) })

  await assert.rejects(
    searchBooks({ query: 'test', fetchImpl }),
    (error) => error instanceof OpenLibraryError && error.kind === 'api',
  )
})

test('normalizer provides safe defaults for missing metadata', () => {
  const book = normalizeBook(null)

  assert.equal(book.title, 'Title unavailable')
  assert.equal(book.source, 'Open Library')
  assert.deepEqual(book.authors, [])
  assert.deepEqual(book.languages, [])
  assert.equal(book.coverId, null)
  assert.equal(book.firstPublishYear, null)
})

test('normalizer maps useful Open Library fields', () => {
  const [book] = normalizeBooks([
    {
      key: '/works/OL262758W',
      title: 'The Hobbit',
      author_name: ['J. R. R. Tolkien'],
      first_publish_year: 1937,
      edition_count: 274,
      language: ['eng'],
      cover_i: 14627518,
    },
  ])

  assert.equal(book.id, '/works/OL262758W')
  assert.equal(book.title, 'The Hobbit')
  assert.deepEqual(book.authors, ['J. R. R. Tolkien'])
  assert.equal(book.firstPublishYear, 1937)
  assert.equal(book.coverId, 14627518)
})

test('URL helpers preserve and restore query and page state', () => {
  const nextUrl = createSearchUrl('The Hobbit', 2, 'https://example.com/page-path/?unrelated=kept')

  assert.equal(nextUrl, '/page-path/?unrelated=kept&search=The+Hobbit&page=2')
  assert.deepEqual(readSearchState(`https://example.com${nextUrl}`), {
    query: 'The Hobbit',
    page: 2,
  })
})
