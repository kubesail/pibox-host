import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faGear, faFile } from '@fortawesome/free-solid-svg-icons'
import { fetchApi } from '@/ui-functions'

export default function Header({ loadUser = true, showNav = true, defaultTab }) {
  const [loading, setLoading] = useState(true)
  const [whoami, setWhoami] = useState(null)
  const [activeTab, setActiveTab] = useState(defaultTab)

  async function getWhoami() {
    if (typeof window === 'undefined') return
    const { body: whoami, status: whoamiStatus } = await fetchApi('/api/whoami')
    setLoading(false)
    setWhoami(whoamiStatus === 200 ? whoami : null)
  }

  function renderTab(iconType, Icon, name, href) {
    const IconElement = iconType === 'fa' ? FontAwesomeIcon : Icon
    return (
      <span className="whitespace-nowrap py-2 group relative">
        <Link
          href={href}
          className={
            'mr-2 inline-flex items-center px-3 py-2 rounded-md group-hover:bg-gray-200 ' +
            (activeTab === name &&
              'text-steel-blue-500 after:visible after:bg-steel-blue-500 after:absolute after:bottom-0 after:right-3 after:left-3 after:h-0.5 after:bg-text-primary')
          }
          onClick={() => setActiveTab(name)}
        >
          <IconElement icon={Icon} className={`mr-2 pr-2}`} />
          {name}
        </Link>
      </span>
    )
  }

  useEffect(() => {
    if (loadUser) {
      getWhoami()
    } else {
      setLoading(false)
    }
  }, [loadUser])

  return (
    <header>
      <div className="bg-steel-blue-500 text-white">
        <div className="px-8 pt-4 pb-4 container mx-auto">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-3xl font-semibold">
              PiBox
            </Link>
            <div className="flex items-center">
              <div>
                {loading ? (
                  <>...</>
                ) : whoami ? (
                  <div>
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
        </div>
      </div>
      {showNav && (
        <div className="bg-gray-100 border-b border-gray-200">
          <div className="px-8 container mx-auto">
            <nav className="-ml-3 flex font-medium text-gray-600 cursor-pointer relative overflow-auto navigation">
              {renderTab('fa', faFile, 'Files', '/')}
              {renderTab('fa', faUser, 'Users', '/users')}
              {renderTab('fa', faGear, 'Settings', '/settings')}
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}
