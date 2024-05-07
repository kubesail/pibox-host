import { useEffect, useState } from 'react'
import { fetchApi } from '@/ui-functions'
import Header from '@/components/Header'
import { faCheck, faCircleNotch, faLock, faNotEqual, faPencilAlt, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { nanoid } from 'nanoid'

function Disk({ onChange, slotNumber, selectable, name, size, vendor, model, selected }) {
  if (!selectable) selected = false

  return (
    <div>
      <h4 className="text-slate-600">Slot {slotNumber}</h4>
      <div
        key={name}
        className={`flex items-center ${selectable ? 'bg-steel-blue-500' : 'bg-gray-300 justify-center'} border border-4 p-4 mb-4 rounded-lg text-white ${
          selected ? 'border-white' : 'border-transparent'
        }`}
        onClick={onChange}
      >
        {!selectable ? (
          <div className="p-4 text-slate-600">Available</div>
        ) : (
          <>
            <h2 className="text-2xl font-bold mr-4">{size}</h2>
            <div className="border h-12 mr-4" />
            <div className="flex flex-col">
              <h3 className="text-white text-xl font-semibold mb-1">{vendor}</h3>
              <h3 className="text-white">{model}</h3>
            </div>
            <div
              className={`flex items-center justify-center ml-auto rounded-full h-12 w-12 border border-4 border-white ${selected ? 'bg-green-500' : ' background-transparent'}`}
            >
              {selected && <FontAwesomeIcon icon={faCheck} className="text-white fa-xl fa-fw" />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [disks, setDisks] = useState(null)
  const [disk0Selected, setDisk0Selected] = useState(true)
  const [disk1Selected, setDisk1Selected] = useState(true)
  const [mirrored, setMirrored] = useState(false)
  const [step, setStep] = useState(1)

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [step2Ready, setStep2Ready] = useState(false)

  const [setupLoading, setSetupLoading] = useState(false)

  useEffect(() => {
    async function fetchDisks() {
      const response = await fetch('/api/disks')
      const jsonData = await response.json()
      setLoading(false)
      setDisks(jsonData)
    }
    async function fetchStatus() {
      const { body } = await fetchApi('/api/status')
      if (body.setupComplete) {
        window.location.href = '/'
      } else {
        fetchDisks()
      }
    }
    fetchStatus()
  }, [])

  return (
    <main className="text-slate-600">
      <Header loadUser={false} showNav={false} />
      <section className="px-8 pt-4 container mx-auto">
        <div className="flex justify-between items-center mb-4 mt-2">
          <h1 className="text-3xl font-semibold">Initial Setup</h1>
          <h2 className="text-xl">Step {step} of 4</h2>
        </div>
        {error ? (
          <p className="border-b-4 border-b-red-500 p-4 bg-red-300">
            <FontAwesomeIcon icon={faTimes} className="text-red-500 mr-4" />
            {error}
          </p>
        ) : loading ? (
          <p>Loading...</p>
        ) : step === 1 ? (
          <>
            <Disk slotNumber={1} selectable={!!disks.disks[0]} {...disks.disks[0]} onChange={() => setDisk0Selected(!disk0Selected)} selected={disk0Selected} />
            <Disk slotNumber={2} selectable={!!disks.disks[1]} {...disks.disks[1]} onChange={() => setDisk1Selected(!disk1Selected)} selected={disk1Selected} />
            <div className="text-slate-700 font-bold text-center text-lg mt-6 mb-6">Total Capacity: {mirrored ? disks.totalCapacityMirrored : disks.totalCapacity}</div>
            {!!disks.disks[0] && !!disks.disks[1] && (
              <>
                <label className="block p-4 bg-white rounded-lg">
                  <input className="mr-2" type="checkbox" onChange={() => setMirrored(!mirrored)} checked={mirrored} />
                  Mirror Data
                </label>
                <p className="text-slate-600 mt-4 mx-6">
                  Mirroring data across both drives increases redundance in case of drive failure. Total capacity will be limited to the smallest drive size.
                </p>
              </>
            )}
            <div className="flex justify-end mt-4">
              <button
                className="bg-steel-blue-500 hover:bg-steel-blue-600 text-white font-bold py-2 px-4 rounded mt-4 "
                onClick={() => {
                  confirm('NOTE: Selected drives will be erased. Are you sure you want to continue?') && setStep(2)
                }}
              >
                Continue
              </button>
            </div>
          </>
        ) : step === 2 ? (
          <>
            <h2 className="text-lg font-semibold mb-2 mt-6">Everything is local.</h2>
            <p>With PiBox, your data is never sent to the cloud. Create a strong password for the owner account. Owners have access to all files and create additional users.</p>

            <label className="block mt-4">
              <span>Full Name</span>
              <input
                type="text"
                className="block w-full mt-1 rounded-lg border border-gray-300 p-4 text-xl"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value)
                  setStep2Ready(e.target.value && password && password === passwordConfirm)
                }}
              />
            </label>

            <label className="block mt-4">
              <span>Password</span>
              <input
                type="password"
                className="block w-full mt-1 rounded-lg border border-gray-300 p-4 text-xl"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setStep2Ready(fullName && e.target.value && e.target.value === passwordConfirm)
                }}
              />
            </label>

            <label className="block mt-4">
              <span>
                Confirm Password
                {passwordConfirm &&
                  (passwordConfirm === password ? (
                    <span className="ml-6 text-xs">
                      <FontAwesomeIcon icon={faCheck} className="mr-1" />
                      Passwords Match
                    </span>
                  ) : (
                    <span className="ml-6 text-xs text-orange-300">
                      <FontAwesomeIcon icon={faNotEqual} className="mr-1" />
                      Passwords Do Not Match
                    </span>
                  ))}
              </span>
              <input
                type="password"
                className={`block w-full mt-1 rounded-lg border border-gray-300 p-4 text-xl`}
                value={passwordConfirm}
                onChange={(e) => {
                  setPasswordConfirm(e.target.value)
                  setStep2Ready(fullName && password && password === e.target.value)
                }}
              />
            </label>

            {/* <label className="block mt-4"> */}

            <div className="flex justify-between mt-4">
              <button className="bg-steel-blue-500 hover:bg-steel-blue-600 text-white font-bold py-2 px-4 rounded mt-4 " onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className={`${step2Ready ? 'bg-steel-blue-500 hover:bg-steel-blue-600' : 'bg-steel-blue-300 cursor-not-allowed'}   text-white font-bold py-2 px-4 rounded mt-4`}
                onClick={() => step2Ready && setStep(3)}
              >
                Next
              </button>
            </div>
          </>
        ) : step === 3 ? (
          <>
            <h2 className="text-lg font-semibold mb-2 mt-6">Remember your password.</h2>
            <p>Everything is stored locally, including your password. If you forget it, your data will be permanently lost.</p>
            <div className="flex justify-center mt-4">
              <FontAwesomeIcon icon={faPencilAlt} style={{ width: 150, height: 150 }} className="text-slate-400 fa-3x mt-4" />
            </div>

            {setupLoading ? (
              <div className="flex justify-center items-center mt-12">
                <FontAwesomeIcon icon={faCircleNotch} className="fa-spin mr-2" />
                Setting up your PiBox. This may take a few seconds...
              </div>
            ) : (
              <div className="flex justify-between mt-4">
                <button className="bg-steel-blue-500 hover:bg-steel-blue-600 text-white font-bold py-2 px-4 rounded mt-4 " onClick={() => setStep(2)}>
                  Back
                </button>
                <button
                  className={`bg-steel-blue-500 hover:bg-steel-blue-600 text-white font-bold py-2 px-4 rounded mt-4`}
                  onClick={async () => {
                    setSetupLoading(true)
                    const disksToFormat = []
                    if (disk0Selected && !!disks.disks[0]) disksToFormat.push(disks.disks[0])
                    if (disk1Selected && !!disks.disks[1]) disksToFormat.push(disks.disks[1])
                    const sessionKey = nanoid()
                    window.localStorage.setItem('sessionKey', sessionKey)
                    const { body, status } = await fetchApi('/api/setup', {
                      method: 'POST',
                      json: {
                        disks: disksToFormat,
                        mirrored,
                        fullName,
                        password,
                        sessionKey,
                        sessionName: 'Web',
                        sessionPlatform: 'Web',
                      },
                    })

                    if (status !== 200) {
                      setError('Error setting up PiBox: ' + body.error)
                      return
                    }

                    setStep(4)
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p>Your PiBox is set up securely. Now just add files!</p>
            <div className="flex flex-col items-center justify-center mt-4">
              <div>
                <FontAwesomeIcon icon={faLock} style={{ width: 150, height: 150 }} className="text-green-500 fa-3x mt-4" />
              </div>
              <div style={{ marginTop: '-105px' }}>
                <FontAwesomeIcon icon={faCheck} style={{ width: 80, height: 80 }} className="text-white fa-3x mt-4" />
              </div>
            </div>

            <div className="flex justify-end mt-12">
              <button
                className={`${step2Ready ? 'bg-steel-blue-500 hover:bg-steel-blue-600' : 'bg-steel-blue-300 cursor-not-allowed'}   text-white font-bold py-2 px-4 rounded mt-4`}
                onClick={() => {
                  window.location.href = '/'
                }}
              >
                Done
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
