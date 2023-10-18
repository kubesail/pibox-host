import React, { useState, useEffect } from 'react'

export default function Disks() {
  const [data, setData] = useState(null)

  useEffect(() => {
    async function fetchData() {
      const response = await fetch('/api/disks')
      const jsonData = await response.json()
      setData(jsonData)
    }
    fetchData()
  }, [])

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-2xl my-8">PiBox Initial Setup: Disks</h1>
      <div className="flex flex-wrap justify-center gap-4 flex-col">
        {data &&
          data.map((disk) => (
            <div className="flex items-center bg-gray-600 p-4 rounded-lg shadow-md" key={disk.name}>
              <h2 className="text-2xl mr-4">{disk.size}</h2>
              <div className="flex flex-col">
                <h3 className="text-white font-bold mb-2">{disk.vendor}</h3>
                <h3 className="text-white">{disk.model}</h3>
              </div>
              <div className="flex ml-auto">
                <p className="mr-2">Empty</p>
                <p>{disk.serial}</p>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
