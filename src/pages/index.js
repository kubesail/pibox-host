import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock } from '@fortawesome/free-solid-svg-icons'
import { fetchApi } from '@/ui-functions'
import Router from 'next/router'
import Header from '@/components/Header'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const [mac, setMac] = useState(false)
  const [whoami, setWhoami] = useState({
    linuxUser: '<username>',
  })

  async function getStatus() {
    if (typeof window === 'undefined') return
    const { body: status } = await fetchApi('/api/status')
    if (!status.setupComplete) {
      Router.push('/setup')
    } else {
      setLoading(false)
      setStatus(status)
    }
  }

  async function getWhoami() {
    if (typeof window === 'undefined') return
    const { body: whoami } = await fetchApi('/api/whoami')
    setWhoami(whoami)
  }

  useEffect(() => {
    getStatus()
    getWhoami()
  }, [])

  return (
    <main className="">
      <Header />
      <section className="px-8 pt-4 container mx-auto">
        <h1 className="text-3xl font-semibold mb-4 mt-2">Welcome to PiBox</h1>
        {loading ? (
          <p>Loading...</p>
        ) : status?.unlocked ? (
          <div>
            <p>
              To access your files from{' '}
              <a className={`${mac ? 'font-semibold' : 'text-blue-500 cursor-pointer '}`} onClick={() => setMac(true)}>
                Mac
              </a>{' '}
              /{' '}
              <a className={`${!mac ? 'font-semibold' : 'text-blue-500 cursor-pointer '}`} onClick={() => setMac(false)}>
                PC
              </a>
              :
            </p>
            {mac ? (
              <ol className="list-decimal list-inside pl-4 mt-4">
                <li>Open Finder → Locations → Network</li>
                <li>Open PIBOX</li>
                <li>Click the &quot;Connect As...&quot; button</li>
                <ol className="list-disc list-inside ml-6">
                  <li>Select &quot;Registered User&quot;</li>
                  <li>
                    Name: <span className="text-slate-600 bg-slate-200 border rounded border-slate-400 px-1 py-0.5 text-sm">{whoami.linuxUser}</span>
                  </li>
                  <li>
                    Password: <span className="text-slate-600 bg-slate-200 border rounded border-slate-400 px-1 py-0.5 text-sm">&lt;your password&gt;</span>
                  </li>
                </ol>
              </ol>
            ) : (
              <ol className="list-decimal list-inside pl-4 mt-4">
                <li>Open File Explorer → This PC</li>
                <li>Right Click → Add Network Location</li>
                <li>
                  Click <b className="font-semibold">Next</b> → Custom Network Location → <b className="font-semibold">Next</b>
                </li>
                <li>
                  Enter <b className="font-semibold">\\pibox.local</b>
                  and click <b className="font-semibold">Browse</b>
                </li>
                <li>Expand &quot;pibox.local&quot;</li>
                <li>A dialog titled &quot;Enter network credentials&quot; appears</li>
                <ol className="list-disc list-inside ml-6">
                  <li>Select &quot;Registered User&quot;</li>
                  <li>
                    User name: <span className="text-slate-600 bg-slate-200 border rounded border-slate-400 px-1 py-0.5 text-sm">{whoami.linuxUser}</span>
                  </li>
                  <li>
                    Password: <span className="text-slate-600 bg-slate-200 border rounded border-slate-400 px-1 py-0.5 text-sm">&lt;your password&gt;</span>
                  </li>
                </ol>
                <li>Select the folder want to map</li>
                <li>
                  Click <b className="font-semibold">Ok</b> → <b className="font-semibold">Next</b> → <b className="font-semibold">Finish</b>
                </li>
              </ol>
            )}
          </div>
        ) : (
          <div>
            <div className="rounded bg-steel-blue-300 px-4 py-2 font-bold">
              <FontAwesomeIcon icon={faLock} /> Disks Locked
            </div>

            <p className="mt-4 mb-4">Your PiBox has been restarted. To protect your data, your disks are locked. Please login as the owner to unlock the disks.</p>

            <Link className="mt-4 bg-steel-blue-500 hover:bg-steel-blue-600 text-white font-bold py-2 px-4 rounded" href="/login">
              Login as Owner
            </Link>
          </div>
        )}
      </section>
    </main>
  )
}
