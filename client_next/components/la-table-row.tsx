import { Course } from '../../@types/scheduler'

const LaRow: React.FC<{
  course: Course
  updateCallback: (c: Course) => Promise<void>
}> = ({ course, updateCallback }) => {
  const handleCheck = async (): Promise<void> => {
    course.supported = !course.supported

    await updateCallback(course)
  }

  return (
    <>
      <tr key={course.uid}>
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
        <th>{course.department}</th>
        <td>{course.courseId}</td>
        <td>{course.abbreviation}</td>
        <td>{course.name}</td>
      </tr>
    </>
  )
}

export default LaRow
