function currentLocation() {
  return globalThis.location ?? { href: 'http://localhost/', origin: 'http://localhost' }
}

export function readSearchState(url = currentLocation().href) {
  const parsedUrl = new URL(url, currentLocation().origin)
  const query = (parsedUrl.searchParams.get('search') || '').trim()
  const requestedPage = Number.parseInt(parsedUrl.searchParams.get('page') || '1', 10)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1

  return { query, page }
}

export function createSearchUrl(query, page, url = currentLocation().href) {
  const nextUrl = new URL(url, currentLocation().origin)
  const normalizedQuery = typeof query === 'string' ? query.trim() : ''
  const safePage = Number.isInteger(page) && page > 0 ? page : 1

  if (normalizedQuery) {
    nextUrl.searchParams.set('search', normalizedQuery)
    nextUrl.searchParams.set('page', String(safePage))
  } else {
    nextUrl.searchParams.delete('search')
    nextUrl.searchParams.delete('page')
  }

  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
}
