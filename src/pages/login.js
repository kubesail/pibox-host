import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleNotch, faWindowClose } from '@fortawesome/free-solid-svg-icons'
import { fetchApi } from '@/ui-functions'
import { useRouter } from 'next/router'
import { nanoid } from 'nanoid'
import Header from '@/components/Header'
import { useSearchParams } from 'next/navigation'

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  // get params from
  const router = useRouter()
  const searchParams = useSearchParams()
  const oneTimePassword = searchParams.get('oneTimePassword')

  if (oneTimePassword && !loading) {
    login()
  }

  async function login() {
    setLoading(true)
    const sessionKey = nanoid()
    window.localStorage.setItem('sessionKey', sessionKey)
    const { body, status } = await fetchApi('/api/login', {
      method: 'POST',
      json: {
        ownerLogin: !oneTimePassword,
        oneTimePassword,
        password,
        sessionKey,
        sessionName: 'Web',
        sessionPlatform: 'Web',
      },
    })
    if (status === 200) {
      router.push('/files')
      return
    }
    setLoading(false)
    setError(body.error)
  }

  if (oneTimePassword) {
    if (error) {
      return (
        <section className="px-8 container mx-auto">
          <div>There was an error logging you in</div>
        </section>
      )
    }
    return (
      <section className="px-8 container mx-auto">
        <div className="flex items-center justify-center h-screen">
          You are being automatically logged in. Please wait.
        </div>
      </section>
    )
  }

  return (
    <>
      <main className="">
        <Header />

        <section className="px-8 container mx-auto">
          <h1 className="text-3xl font-semibold mb-4 mt-2">Owner Login</h1>
          <form>
            <input
              className="border border-gray-300 p-2 w-full rounded"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-red-500">{error}</p>}
            {loading ? (
              <div className="mt-4 bg-steel-blue-500 hover:bg-steel-blue-600 text-white font-bold py-2 px-7 rounded inline-block">
                <FontAwesomeIcon icon={faCircleNotch} className="fa-spin" />
              </div>
            ) : (
              <button
                className="mt-4 bg-steel-blue-500 hover:bg-steel-blue-600 text-white font-bold py-2 px-4 rounded"
                onClick={login}
              >
                Login
              </button>
            )}
          </form>
        </section>
        <section className="px-8 container mx-auto flex justify-center">
          <div className="mt-24 flex justify-center border rounded p-4 bg-pibox-gray-300">
            <b className="mr-2">Tip:</b> To login as a collaborator, scan a QR code from the owner&apos;s device.
          </div>
        </section>
      </main>
    </>
  )
}
