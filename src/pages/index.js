import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  return (
    <>
      <Head>
        <title>PiBox</title>
        <meta name="description" content="Everything is local" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="">
        <header>
          <div className="px-8 pt-4 container mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-semibold">PiBox</h2>
            </div>

            <nav className="flex font-medium relative navigation">Home</nav>
          </div>
        </header>

        <section className="px-8 pt-4 container mx-auto">
          <p>
            See <Link href="/disks">Disks</Link>
          </p>
        </section>
      </main>
    </>
  )
}
