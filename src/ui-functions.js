export async function fetchApi(url, opts) {
  opts = opts || {}
  opts.headers = opts.headers || {}
  opts.headers['Content-Type'] = 'application/json'
  opts.headers['Authorization'] = `bearer ${localStorage.getItem('sessionKey')}`
  if (opts.json) {
    opts.body = JSON.stringify(opts.json)
  }
  const res = await fetch(url, opts)
  const status = res.status
  const body = await res.json()
  return { body, status }
}
