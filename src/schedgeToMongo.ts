import { Course } from '../@types/scheduler'
import { CourseModel } from './db'

interface SchoolSubject {
  school: string
  subject: string
}

async function getSchoolAndSubjects (): Promise<SchoolSubject[]> {
  const url = 'https://schedge.a1liu.com'
  const apiResponse = await fetch(url + '/subjects')
  const response = await apiResponse.json()
  const schoolSubjectObjects: SchoolSubject[] = []
  for (const school of ['UA', 'UB', 'UF', 'UE', 'UY']) {
    for (const subject of Object.getOwnPropertyNames(response[school])) {
      const schoolSubjectObject: SchoolSubject = {
        school,
        subject
      }
      schoolSubjectObjects.push(schoolSubjectObject)
    }
  }
  return schoolSubjectObjects
}

async function forEachCourse (callback: (course: Course) => void | Promise<void>): Promise<void> {
  const schoolSubjectObjects: SchoolSubject[] = await getSchoolAndSubjects()
  for (const schoolSubject of schoolSubjectObjects) {
    const url = `https://schedge.a1liu.com/2022/fa/${schoolSubject.school}/${schoolSubject.subject}`
    const apiResponse = await fetch(url)
    const response = await apiResponse.json()
    for (const albertCourse of response) {
      const sectionNames: Set<string> = new Set<string>()
      for (const albertSection of albertCourse.sections) {
        sectionNames.add(albertSection.name)
      }
      for (const sectionName of sectionNames) {
        const course = new Course(
          sectionName,
          schoolSubject.school,
          albertCourse.deptCourseId,
          schoolSubject.subject,
          false
        )
        await callback(course)
      }
    }
  }
}

async function addCourseToMongo (course: Course): Promise<void> {
  CourseModel.findOneAndUpdate({
    name: course.name,
    department: course.department,
    courseId: course.courseId,
    school: course.school
  }, {}, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true
  })
    .catch(console.log)
}

forEachCourse(addCourseToMongo).catch(console.log)
