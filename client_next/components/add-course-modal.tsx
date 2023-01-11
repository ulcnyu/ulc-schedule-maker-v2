import { useEffect, useState } from 'react'
import { FaPlus } from 'react-icons/fa'
import { useSWRConfig } from 'swr'
import {
  ApiErrorResponse,
  ApiSuccessResponse,
  Course
} from '../../@types/scheduler'
import useDebounce from '../hooks/useDebounce'
import TableRow from './dashboard-table-row'

const AddCourseModal: React.FC = () => {
  const [searchText, setSearchText] = useState('')
  const [courses, setCourses] = useState<Course[]>([])

  const search = useDebounce(searchText, 500)
  const { mutate } = useSWRConfig()

  const courseFetcher = async (query: string): Promise<Course[]> => {
    const url = `/api/course-catalog?query=${query.trim()}`

    const res = await fetch(url, {
      method: 'GET'
    })

    if (res.status >= 400) {
      const error = (await res.json()) as ApiErrorResponse
      console.log(error.message)
    }

    const resJson = (await res.json()) as ApiSuccessResponse<Course[]>
    const courses = resJson.data

    return courses
  }

  const courseSetter = async (): Promise<void> => {
    const courses = await courseFetcher(searchText)
    setCourses(courses)
  }

  useEffect(() => {
    void courseSetter()
  }, [search])

  const updateFn = async (c: Course): Promise<Course[]> => {
    const url = '/api/course-catalog/update'

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(c)
    })

    const courses = await courseFetcher(searchText)

    return courses
  }

  const editCallback = async (c: Course): Promise<void> => {
    const courses = await updateFn(c)
    setCourses(courses)
    await mutate('/api/course-catalog/supported')
  }

  const tableRows = courses.slice(0, 20).map((course) => {
    return (
      <TableRow
        course={course}
        updateFn={editCallback}
        showButtons={false}
        key={course.uid}
      ></TableRow>
    )
  })

  return (
    <div className="modal-box max-w-full flex flex-col gap-4 relative overflow-visible">
      <a href="#" className="btn btn-sm btn-circle absolute right-2 top-2">
        ✕
      </a>
      <h1 className="text-2xl font-bold">Course Search</h1>
      <div className="flex flex-row mb-2 gap-2">
        <input
          type="text"
          placeholder="Search for course, or create one if it does not show up..."
          className="input input-sm w-full bg-gray-100 text-gray-800"
          onChange={(e) => {
            setSearchText(e.target.value)
          }}
          value={searchText}
        />
        <label
          htmlFor="form-modal"
          className="btn btn-sm bg-purple-200 hover:bg-purple-300 text-purple-900 border-0 self-center"
        >
          {' '}
          <span className="pr-2">
            <FaPlus />
          </span>
          Create Course
        </label>
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
          <tbody>{search.length !== 0 ? tableRows : <></>}</tbody>
        </table>
      </div>
    </div>
  )
}

export default AddCourseModal
