/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { NextPage } from 'next'
import { useState } from 'react'
import useSWR from 'swr'
import { Course } from '../../@types/scheduler'
import { FaPlus } from 'react-icons/fa'
import AddCourseModal from '../components/add-course-modal'
import TableRow from '../components/dashboard-table-row'
import CreateCourseForm from '../components/create-course-form'

const CourseDashboard: NextPage = () => {
  const [searchText, setSearchText] = useState<string>('')

  const courseFetcher = async (url: string): Promise<Course[]> => {
    return await fetch(url).then(
      async (r) => (await r.json()).data as Course[]
    )
  }

  const { data, mutate } = useSWR<Course[]>(
    '/api/course-catalog/supported',
    courseFetcher
  )

  const updateFn = async (c: Course): Promise<Course[]> => {
    const url = '/api/course-catalog/update'

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(c)
    })

    const courses = await courseFetcher('/api/course-catalog/supported')

    return courses
  }

  const editCallback = async (c: Course): Promise<void> => {
    await mutate(updateFn(c), {
      optimisticData: (currentData) => {
        if (currentData === undefined) {
          return []
        }

        const index = currentData.findIndex((course) => course.uid === c.uid)

        currentData[index] = c
        return currentData
      },
      rollbackOnError: true,
      populateCache: true,
      revalidate: false
    })
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
        <>
          <TableRow
            course={course}
            updateFn={editCallback}
            showButtons={true}
            key={course.uid}
          ></TableRow>
        </>
      )
    })

  return (
    <div className="max-w-full rounded-2xl bg-white p-2 m-4">
      <h1 className="text-4xl text-left pt-2 pb-4 pl-2 text-gray-800 font-bold">
        Courses
      </h1>

      <div className="flex flex-row mb-2 gap-2">
        <input
          type="text"
          placeholder="Search"
          className="input input-sm w-full bg-gray-100 text-gray-800"
          onChange={(e) => {
            setSearchText(e.target.value)
          }}
        />
        <a
          href="#my-modal-2"
          className="btn btn-sm bg-purple-200 hover:bg-purple-300 text-purple-900 border-0 self-center"
        >
          {' '}
          <span className="pr-2">
            <FaPlus />
          </span>
          Add Course
        </a>
      </div>

      <div className="overflow-x-auto w-full" data-theme="emerald">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Department</th>
              <th>ID</th>
              <th>ULC Name</th>
              <th>Official Name</th>
              <th>Offered</th>
              <th></th>
            </tr>
          </thead>
          <tbody>{tableRows}</tbody>
        </table>
      </div>
      <div className="modal" id="my-modal-2" data-theme="emerald">
        <AddCourseModal></AddCourseModal>
      </div>
      <input type="checkbox" id="form-modal" className="modal-toggle" />
      <div className="modal" data-theme="emerald">
        <CreateCourseForm
          course={undefined}
          editMode={false}
        ></CreateCourseForm>
      </div>
    </div>
  )
}

export default CourseDashboard
