import { useEffect, useState } from 'react'
import { fetchApi } from '@/ui-functions'
import Header from '@/components/Header'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState([])
  const [passwordLogin, setPasswordLogin] = useState([])

  async function updateSshSettings({ enabled, passwordLogin }) {
    setLoading(true)
    setEnabled(enabled)
    setPasswordLogin(passwordLogin)
    if (typeof window === 'undefined') return
    await fetchApi('/api/ssh', {
      method: 'POST',
      body: JSON.stringify({ enabled, passwordLogin }),
    })
    setLoading(false)
  }

  useEffect(() => {
    async function whoami() {
      if (typeof window === 'undefined') return
      const { body } = await fetchApi('/api/whoami')
      if (body.piboxConfigUser) {
        getSshSettings()
      } else {
        window.location.href = '/login'
      }
    }

    async function getSshSettings() {
      if (typeof window === 'undefined') return
      const { body } = await fetchApi('/api/ssh')
      setLoading(false)
      setEnabled(body.enabled)
      setPasswordLogin(body.passwordLogin)
    }
    whoami()
  }, [])

  return (
    <>
      <main className="">
        <Header />
        <section className="px-8 pt-4 container mx-auto">
          <h1 className="text-3xl font-semibold mb-4 mt-2">System Settings</h1>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <>
              <label className="block mb-4">
                <input className="mr-2" type="checkbox" checked={enabled} onChange={(e) => updateSshSettings({ enabled: e.target.checked, passwordLogin })} />
                Enable SSH
              </label>
              <label>
                <input className="mr-2" type="checkbox" checked={passwordLogin} onChange={(e) => updateSshSettings({ enabled, passwordLogin: e.target.checked })} />
                Allow SSH Password login
              </label>
            </>
          )}
        </section>
      </main>
    </>
  )
}
