import { NextPage } from 'next'
import { useEffect, useState } from 'react'
import { Course } from '../../@types/scheduler'
import CopyButton from '../components/copy-button'
import LaRow from '../components/la-table-row'

const LaDashboard: NextPage = () => {
  const [searchText, setSearchText] = useState('')
  const [data, setData] = useState<Course[]>([])

  const courseFetcher = async (url: string): Promise<Course[]> => {
    return await fetch(url).then(
      async (r) => (await r.json()).data as Course[]
    )
  }

  const fetchCourses = async (): Promise<void> => {
    const courses = await courseFetcher('/api/course-catalog/supported')

    const inverted = courses.map((c) => {
      c.supported = !c.supported
      return c
    })

    setData(inverted)
  }

  useEffect(() => {
    void fetchCourses()
  }, [])

  // const { data, mutate } = useSWR<Course[]>(
  //   '/api/course-catalog/supported',
  //   courseFetcher,
  //   {
  //     revalidateOnFocus: false,
  //     revalidateIfStale: false,
  //     revalidateOnReconnect: false
  //   }
  // )

  const updateFn = (c: Course): Course[] => {
    const indexToUpdate = data.findIndex((course) => {
      return c.uid === course.uid
    })

    const copy = [...data]
    copy[indexToUpdate] = c

    return copy
  }

  const editCallback = async (c: Course): Promise<void> => {
    setData(updateFn(c))
  }

  const tableRows = data
    ?.filter((course) => {
      // course.name
      return (
        (course.name?.toLowerCase().indexOf(searchText.toLowerCase()) ?? -1) >
        -1
      )
    })
    .map((course) => {
      return (
        <LaRow
          course={course}
          key={course.uid}
          updateCallback={editCallback}
        ></LaRow>
      )
    })

  const laText = data
    .filter((c) => c.supported)
    .map((c) => c.abbreviation ?? c.name)
    .join(', ')

  return (
    <div className="max-w-full rounded-2xl bg-white p-2 m-4 flex flex-col">
      <h1 className="text-4xl text-left pt-2 pl-2 pb-4 text-gray-800 font-bold">
        Blurb Maker
      </h1>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <input
            type="text"
            placeholder="Search"
            className="input input-sm w-full mb-2 bg-gray-100 text-gray-800"
            onChange={(e) => {
              setSearchText(e.target.value)
            }}
          />
          <div className="overflow-x-auto w-full" data-theme="emerald">
            <table className="table w-full">
              <thead>
                <tr>
                  <th></th>
                  <th>Department</th>
                  <th>ID</th>
                  <th>ULC Name</th>
                  <th>Official Name</th>
                </tr>
              </thead>
              <tbody>{tableRows}</tbody>
            </table>
          </div>
        </div>
        <div className="col-span-1 mt-10 p-2 rounded-lg bg-gray-100 relative">
          <h2 className="text-3xl mt-2 mb-2 font-bold text-slate-800">Blurb</h2>
          <p className="text-slate-500">
            {laText === '' ? 'Make a selection to get blurb...' : laText}
          </p>
          <div className='absolute top-2 right-2'>
            <CopyButton copyText={laText}></CopyButton>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LaDashboard
