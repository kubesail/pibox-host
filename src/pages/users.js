import { useEffect, useState } from 'react'
import { fetchApi } from '@/ui-functions'
import Header from '@/components/Header'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeftLong, faChevronRight, faPlus } from '@fortawesome/free-solid-svg-icons'
import { QRCodeSVG } from 'qrcode.react'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [loginCode, setLoginCode] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addingUser, setAddingUser] = useState(false)
  const [newUserFullName, setNewUserFullName] = useState('')

  async function getUsers() {
    if (typeof window === 'undefined') return
    const { body } = await fetchApi('/api/users')
    setLoading(false)
    setUsers(body)
  }

  useEffect(() => {
    async function whoami() {
      if (typeof window === 'undefined') return
      const { body } = await fetchApi('/api/whoami')
      if (body.piboxConfigUser) {
        getUsers()
      } else {
        window.location.href = '/login'
      }
    }

    whoami()
  }, [])

  return (
    <>
      <main className="">
        <Header defaultTab="Users" />
        <section className="px-8 pt-4 container mx-auto">
          {loading ? (
            <p>Loading...</p>
          ) : selectedUser ? (
            <>
              <h1 className="text-3xl font-semibold mb-4 mt-2 flex items-center">
                <FontAwesomeIcon
                  icon={faArrowLeftLong}
                  className="mr-2 text-lg text-steel-blue-500 cursor-pointer"
                  onClick={() => {
                    setSelectedUser(null)
                    setLoginCode(null)
                  }}
                />
                {selectedUser.fullName}
              </h1>
              <div className="bg-white p-4 rounded">
                <div className="mb-2 pb-2 border-b">
                  Login Username: <span className="text-sm border border-gray-300 bg-gray-100 px-1 py-0.5 font-mono rounded">{selectedUser.username}</span>
                </div>

                {confirmDelete ? (
                  <div>
                    <p className="text-red-500">Are you sure you want to delete this user?</p>
                    <div className="flex justify-end">
                      <button
                        className="bg-red-500 text-white px-4 py-1 rounded mr-2"
                        onClick={async () => {
                          const { status, body } = await fetchApi(`/api/users/${selectedUser.username}`, { method: 'DELETE' })
                          setConfirmDelete(false)
                          if (status !== 200) {
                            window.alert('Error deleting user: ' + body.error)
                            return
                          }
                          setSelectedUser(null)
                          setLoginCode(null)
                          setUsers(users.filter((user) => user.username !== selectedUser.username))
                        }}
                      >
                        Delete
                      </button>
                      <button className="bg-gray-300 text-gray-800 px-4 py-1 rounded" onClick={() => setConfirmDelete(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <a
                      className="block hover:underline cursor-pointer text-steel-blue-500"
                      onClick={async () => {
                        const { status, body } = await fetchApi('/api/one-time-password', { method: 'POST', json: { user: selectedUser.username } })
                        if (status !== 200) {
                          window.alert('Error generating QR code: ' + body.error)
                          return
                        }
                        setLoginCode(body.qrCode)
                      }}
                    >
                      Generate QR code to grant access
                    </a>
                    <a className="block hover:underline cursor-pointer text-red-500" onClick={() => setConfirmDelete(true)}>
                      Delete
                    </a>
                    {loginCode && (
                      <div className="flex flex-col items-center justify-center mt-8 mb-5">
                        <QRCodeSVG size={200} value={loginCode} />

                        <div className="mt-8">
                          <h3 className="mb-2">
                            Login instructions for <span className="font-bold">{selectedUser.fullName}</span>
                          </h3>
                          <ul className="list-disc list-inside">
                            <li className="text-sm">Download the PiBox app</li>
                            <li className="text-sm">Scan this QR code to login</li>
                            <li className="text-sm">This code will expire in 5 minutes</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : addingUser ? (
            <div className="">
              <h1 className="text-3xl font-semibold mb-4 mt-2 flex items-center">
                <FontAwesomeIcon
                  icon={faArrowLeftLong}
                  className="mr-2 text-lg text-steel-blue-500 cursor-pointer"
                  onClick={() => {
                    setAddingUser(false)
                    setNewUserFullName('')
                  }}
                />
                Add User
              </h1>
              <div className="mb-4 bg-white p-4 rounded">
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  value={newUserFullName}
                  onChange={(e) => setNewUserFullName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-steel-blue-500 focus:border-steel-blue-500 sm:text-sm"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setLoading(true)
                    fetchApi('/api/users', { method: 'POST', json: { fullName: newUserFullName } }).then(({ status, body }) => {
                      if (status !== 201) {
                        window.alert('Error adding user: ' + body.error)
                        return
                      }
                      setNewUserFullName('')
                      setAddingUser(false)
                      setTimeout(getUsers, 1000)
                    })
                  }}
                  className="bg-steel-blue-500 text-white px-4 py-1 rounded mr-2"
                >
                  Add User
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h1 className="text-3xl font-semibold mb-4 mt-2">Users</h1>
                <div className="text-steel-blue-500 text-sm cursor-pointer" onClick={() => setAddingUser(true)}>
                  <FontAwesomeIcon icon={faPlus} className="mr-2" />
                  Add User
                </div>
              </div>
              <ul className="rounded bg-white p-4">
                {users.map((user) => (
                  <li
                    key={user.username}
                    className="border-b border-gray-200 py-2 first-of-type:pt-0 last-of-type:pb-0 last-of-type:border-none flex justify-between items-center cursor-pointer hover:bg-gray-100"
                    onClick={() => setSelectedUser(user)}
                  >
                    <div className="flex">
                      <div className="w-16 text-xs text-white flex justify-center items-center rounded" style={{ background: user.color }}>
                        {user.username}
                      </div>
                      <div className="ml-2">
                        <div className="-mb-1">{user.fullName}</div>
                        <div className="text-gray-500 text-xs">{user.isOwner ? 'Owner' : 'Collaborator'}</div>
                      </div>
                    </div>
                    <FontAwesomeIcon icon={faChevronRight} className="mr-2" />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>
    </>
  )
}
