import { useState } from 'react'
import { useSWRConfig } from 'swr'
import { ApiErrorResponse, Course } from '../../@types/scheduler'

const CreateCourseForm: React.FC<{
  course: Course | undefined
  editMode: boolean
}> = ({ course, editMode }) => {
  // const [course, setCourse] = useState(new Course('', '', '', '', true, undefined, undefined))
  const [name, setName] = useState(() => {
    return course !== undefined ? course.name : ''
  })
  const [abbreviation, setAbbreviation] = useState(() =>
    course !== undefined ? course.abbreviation : ''
  )
  const [courseId, setCourseId] = useState(() =>
    course !== undefined ? course.courseId : ''
  )
  const [department, setDepartment] = useState(() =>
    course !== undefined ? course.department : ''
  )
  const [school, setSchool] = useState(() =>
    course !== undefined ? course.school : ''
  )

  const [error, setError] = useState('')

  const { mutate } = useSWRConfig()

  const handleClick = async (): Promise<void> => {
    const courseInput: Course = {
      uid: course?.uid ?? '',
      name,
      abbreviation,
      courseId,
      department,
      supported: true,
      school,
      matchScore: (c: string) => {
        return 1
      }
    }

    let res
    if (!editMode) {
      res = await fetch('/api/course-catalog/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(courseInput)
      })
    } else {
      res = await fetch('/api/course-catalog/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(courseInput)
      })
    }

    if (res.status >= 400) {
      const e = (await res.json()) as ApiErrorResponse
      setError(`${e.message}. Did you add every field?`)
      return
    }

    await mutate('/api/course-catalog/supported')

    if (!editMode) {
      setName('')
      setAbbreviation('')
      setCourseId('')
      setDepartment('')
      setSchool('')
    }

    const checkbox = document.getElementById('form-modal') as HTMLInputElement
    const editCheckbox = document.getElementById(
      `edit-modal-${courseInput.uid}`
    ) as HTMLInputElement
    if (checkbox !== undefined) {
      checkbox.checked = false
    }
    if (editCheckbox !== undefined) {
      editCheckbox.checked = false
    }
  }

  return (
    <div className="modal-box max-w-md flex flex-col gap-4 relative">
      <label
        htmlFor={
          editMode ? `edit-modal-${(course as Course).uid}` : 'form-modal'
        }
        className="btn btn-sm btn-circle absolute right-2 top-2"
      >
        ✕
      </label>
      <h1 className="text-2xl font-bold">Create Course</h1>
      <div className="form-control w-full max-w-full">
        <label className="label">
          <span className="label-text">Class Name</span>
        </label>
        <input
          type="text"
          className="input input-bordered w-full"
          onChange={(e) => {
            setName(e.target.value)
          }}
          value={name}
        />
      </div>
      <div className="form-control w-full max-w-full">
        <label className="label">
          <span className="label-text">Department</span>
        </label>
        <input
          type="text"
          className="input input-bordered w-full"
          onChange={(e) => {
            setDepartment(e.target.value)
          }}
          value={department}
        />
      </div>
      <div className="form-control w-full max-w-full">
        <label className="label">
          <span className="label-text">School Code</span>
        </label>
        <input
          type="text"
          className="input input-bordered w-full"
          onChange={(e) => {
            setSchool(e.target.value)
          }}
          value={school}
        />
      </div>
      <div className="form-control w-full max-w-full">
        <label className="label">
          <span className="label-text">Course ID</span>
        </label>
        <input
          type="text"
          className="input input-bordered w-full"
          onChange={(e) => {
            setCourseId(e.target.value)
          }}
          value={courseId}
        />
      </div>
      <div className="form-control w-full max-w-full">
        <label className="label">
          <span className="label-text">ULC Name</span>
        </label>
        <input
          type="text"
          className="input input-bordered w-full"
          onChange={(e) => {
            setAbbreviation(e.target.value)
          }}
          value={abbreviation}
        />
      </div>
      <button
        className="btn w-full bg-purple-200 hover:bg-purple-300 text-purple-900 border-0 self-center"
        onClick={async () => {
          await handleClick()
        }}
      >
        {editMode ? 'Edit' : 'Create'}
      </button>
      <div className="text-red-500">{error}</div>
    </div>
  )
}

export default CreateCourseForm
