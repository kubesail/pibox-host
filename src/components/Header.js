import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser } from '@fortawesome/free-solid-svg-icons'
import { fetchApi } from '@/ui-functions'

export default function Header({ loadUser = true }) {
  const [loading, setLoading] = useState(true)
  const [whoami, setWhoami] = useState(null)

  async function getWhoami() {
    if (typeof window === 'undefined') return
    const { body: whoami, status: whoamiStatus } = await fetchApi('/api/whoami')
    setLoading(false)
    setWhoami(whoamiStatus === 200 ? whoami : null)
  }

  useEffect(() => {
    if (loadUser) {
      getWhoami()
    } else {
      setLoading(false)
    }
  }, [loadUser])

  return (
    <header className="bg-steel-blue-500 text-white">
      <div className="px-8 pt-4 container mx-auto pb-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-3xl font-semibold">
            PiBox
          </Link>
          <div>
            {loading ? (
              <>...</>
            ) : whoami ? (
              <div className="mr-4">
                <FontAwesomeIcon icon={faUser} className="mr-1" />
                {whoami?.linuxUser}
                <Link href="/logout" className="ml-4">
                  Logout
                </Link>
              </div>
            ) : (
              <div>
                <Link href="/login">Login</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
