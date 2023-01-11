import { FaRegEdit } from 'react-icons/fa'
import { Course } from '../../@types/scheduler'
import CreateCourseForm from './create-course-form'

const TableRow: React.FC<{
  course: Course
  updateFn: (c: Course) => Promise<void>
  showButtons: boolean
}> = ({ course, updateFn, showButtons }) => {
  const handleCheck = async (): Promise<void> => {
    course.supported = !course.supported

    await updateFn(course)
  }

  const buttons = showButtons
    ? (
    <th className="flex gap-2 flex-row-reverse">
      <label
        htmlFor={`edit-modal-${course.uid}`}
        className="btn btn-ghost text-lg btn-square"
      >
        <FaRegEdit></FaRegEdit>
      </label>
    </th>
      )
    : (
    <></>
      )

  return (
    <>
      <tr key={course.uid}>
        <th>{course.department}</th>
        <td>{course.courseId}</td>
        <td>{course.abbreviation}</td>
        <td>{course.name}</td>
        <th>
          <label>
            <input
              type="checkbox"
              className="checkbox"
              checked={course.supported}
              onChange={async (e) => {
                await handleCheck()
              }}
            />
          </label>
        </th>
        {buttons}
      </tr>
      <input
        type="checkbox"
        id={`edit-modal-${course.uid}`}
        className="modal-toggle"
      />
      <div className="modal" data-theme="emerald">
        <CreateCourseForm course={course} editMode={true}></CreateCourseForm>
      </div>
    </>
  )
}

export default TableRow
