import { useEffect, useState } from 'react'
import { fetchApi } from '@/ui-functions'
import Header from '@/components/Header'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [files, setFiles] = useState([])

  async function listFiles(path = '/') {
    if (typeof window === 'undefined') return
    const { body } = await fetchApi('/api/files')
    setLoading(false)
    setFiles(body)
  }

  useEffect(() => {
    listFiles()
  }, [])

  return (
    <>
      <main className="">
        <Header />

        <section className="px-8 pt-4 container mx-auto">
          <h1 className="text-3xl font-semibold mb-4 mt-2">Files</h1>
          {loading ? <p>Loading...</p> : files.map((file) => <div key={file.name}>{file.name}</div>)}
        </section>
      </main>
    </>
  )
}
