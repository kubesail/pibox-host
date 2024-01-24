import { useEffect, useState } from 'react'
import { fetchApi } from '@/ui-functions'
import Header from '@/components/Header'

export default function Home() {
  const [loading, setLoading] = useState(true)

  async function logout() {
    if (typeof window === 'undefined') return
    const { body: status } = await fetchApi('/api/logout', { method: 'POST' })
    setLoading(false)
  }

  useEffect(() => {
    logout()
  }, [])

  return (
    <main className="">
      <Header loadUser={false} />
      <section className="px-8 pt-4 container mx-auto">
        <h1 className="text-3xl font-semibold mb-4 mt-2">{loading ? 'Logging out...' : 'Successfully logged out'}</h1>
        {!loading && <p>You have been logged out. You may close this window.</p>}
      </section>
    </main>
  )
}
