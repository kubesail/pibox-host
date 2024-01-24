import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock } from '@fortawesome/free-solid-svg-icons'
import { fetchApi } from '@/ui-functions'
import Header from '@/components/Header'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)

  async function getStatus() {
    if (typeof window === 'undefined') return
    const { body: status } = await fetchApi('/api/status')
    setLoading(false)
    setStatus(status)
  }

  useEffect(() => {
    getStatus()
  }, [])

  return (
    <main className="">
      <Header />
      <section className="px-8 pt-4 container mx-auto">
        <h1 className="text-3xl font-semibold mb-4 mt-2">Welcome to PiBox</h1>
        {loading ? (
          <p>Loading...</p>
        ) : (
          !status?.unlocked && (
            <div>
              <div className="rounded bg-steel-blue-300 px-4 py-2 font-bold">
                <FontAwesomeIcon icon={faLock} /> Disks Locked
              </div>

              <p className="mt-4 mb-4">
                Your PiBox has been restarted. To protect your data, your disks are locked. Please login as the owner to
                unlock the disks.
              </p>

              <Link
                className="mt-4 bg-steel-blue-500 hover:bg-steel-blue-600 text-white font-bold py-2 px-4 rounded"
                href="/login"
              >
                Login as Owner
              </Link>
            </div>
          )
        )}
      </section>
    </main>
  )
}
