const API_ORIGIN = 'https://planning-report-api.onrender.com'

export async function onRequest({ request }) {
  const upstreamUrl = new URL(request.url)
  const apiUrl = new URL(API_ORIGIN)
  upstreamUrl.protocol = apiUrl.protocol
  upstreamUrl.host = apiUrl.host

  return fetch(new Request(upstreamUrl, request))
}
