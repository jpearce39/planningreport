const API_ORIGIN = 'https://planning-report-api.onrender.com'

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url)

    if (requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/')) {
      const apiUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, API_ORIGIN)
      return fetch(new Request(apiUrl, request))
    }

    return env.ASSETS.fetch(request)
  },
}
