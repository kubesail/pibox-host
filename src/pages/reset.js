import { useEffect, useState } from 'react'
import { fetchApi } from '@/ui-functions'
import Header from '@/components/Header'
import { faCheck, faTimes, faWarning } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [generatedCode, setGeneratedCode] = useState(false)
  const [firstLine, setFirstLine] = useState('')
  const [secondLine, setSecondLine] = useState('')
  const [finalOutput, setFinalOutput] = useState('')

  async function drawResetCode() {
    if (typeof window === 'undefined') return
    setLoading(true)
    const { status, body } = await fetchApi('/api/reset-setup-code', { method: 'POST' })
    if (status !== 200) {
      setError(body.error)
      setLoading(false)
      return
    }
    setLoading(false)
    setGeneratedCode(true)
  }

  async function reset() {
    if (typeof window === 'undefined') return
    setLoading(true)
    const { status, body } = await fetchApi('/api/reset-setup', {
      method: 'POST',
      json: {
        resetCode: firstLine + secondLine,
        YES_I_KNOW_WHAT_IM_DOING_AND_UNDERSTAND_THIS_WILL_DELETE_DATA: true,
      },
    })
    setLoading(false)

    if (status === 400) {
      setError(body.error)
      return
    }

    // if (status !== 200) {
    //   setFinalOutput(
    //     <>
    //       <h2>
    //         <FontAwesomeIcon icon={faCheck} className="text-green-500 mr-4" />
    //         Reset completed with warnings
    //       </h2>
    //       <pre>{body.error}</pre>
    //     </>
    //   )
    //   return
    // }
    setFinalOutput(
      <>
        <h2>
          <FontAwesomeIcon icon={faCheck} className="text-green-500 mr-4" />
          Reset completed successfully
        </h2>
        <p>Your PiBox has been reset to factory settings. You can use the PiBox app to set it up again.</p>
      </>
    )
  }

  const inputValid = firstLine.length === 4 && secondLine.length === 4

  return (
    <main className="">
      <Header loadUser={false} />
      <section className="px-8 pt-4 container mx-auto">
        <h1 className="text-3xl font-semibold mb-4 mt-2">Reset your PiBox</h1>
        {loading && <p>Loading...</p>}

        {error ? (
          <p className="border-b-4 border-b-red-500 p-4 bg-red-300">
            <FontAwesomeIcon icon={faTimes} className="text-red-500 mr-4" />
            {error}
          </p>
        ) : (
          generatedCode === false && (
            <>
              <p className="border-b-4 border-b-red-500 p-4">
                <FontAwesomeIcon icon={faWarning} className="text-red-500 mr-4" />
                You are about to factory reset your PiBox. This will DELETE ALL DATA and CANNOT BE UNDONE.
              </p>
              <button onClick={drawResetCode} className="bg-red-500 text-white font-bold py-2 px-4 rounded mt-4">
                Generate Reset Code
              </button>
            </>
          )
        )}

        {finalOutput && <div className="mt-4">{finalOutput}</div>}

        {!finalOutput && generatedCode && (
          <div className="flex flex-col">
            {!inputValid && <p>Enter the reset code displayed on the front screen of your PiBox</p>}
            <input
              type="text"
              value={firstLine}
              className="w-full bg-gray-200 p-4 mt-4 w-48 text-red-500 font-bold text-xl"
              onChange={(e) => {
                setFirstLine(e.target.value.toUpperCase())
                if (e.target.value.length === 4) {
                  document.getElementById('secondLine').focus()
                }
              }}
            />
            <input
              id="secondLine"
              type="text"
              value={secondLine}
              className="w-full bg-gray-200 p-4 mt-4 w-48 text-red-500 font-bold text-xl"
              onChange={(e) => setSecondLine(e.target.value.toUpperCase())}
            />
            {inputValid && (
              <button onClick={reset} className="bg-red-500 text-white font-bold py-2 px-4 rounded mt-4">
                Reset My PiBox. Delete All Data.
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
