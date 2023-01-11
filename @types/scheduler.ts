import { calendar_v3 } from '@googleapis/calendar'
import { v4 } from 'uuid'
import Event = calendar_v3.Schema$Event

export interface CalendarInfo {
  id: string // gcal id used in api call
  name: string // aka summary
}

export interface Interval {
  start: Date
  end: Date
}

interface CourseInterface {
  supported: boolean // if the ulc provides tutoring for this class
  abbreviation: string | undefined // the ulc abbreviation
  name: string
  department: string // department code (CSCI, MATH, etc)
  courseId: string // course id in a department (101, 102, etc)
  school: string // school code (UA, UY, etc)
  uid: string // unique id of the string

  matchScore: (courseGiven: string) => number
}

export class Course implements CourseInterface {
  public abbreviation: string | undefined
  public uid: string

  constructor (
    public name: string,
    public school: string,
    public courseId: string,
    public department: string,
    public supported: boolean,
    abbreviation?: string,
    uid?: string
  ) {
    if (!supported || typeof abbreviation === 'undefined') {
      this.abbreviation = undefined
    } else {
      this.abbreviation = abbreviation
    }

    this.uid = uid ?? v4()
  }

  // TODO: have a fuzzier way to match a course
  matchScore (courseGiven: string): number {
    if (this.supported) {
      return courseGiven === this.abbreviation ? 1 : 0
    }
    return 0
  }
}

export type CourseCatalog = Course[]

export type DayNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6

interface IntervalInterface {
  start: Date
  end: Date
  readonly weekDay: DayNumber
}

export class Interval implements IntervalInterface {
  constructor (start: Date, end: Date) {
    this.start = start
    this.end = end
  }

  get weekDay (): DayNumber {
    const startWeekDay: number = this.start.getDay()
    // const endWeekDay: number = this.end.getDay()
    // if (startWeekDay !== endWeekDay) {
    //   throw new Error('Event takes place over more than one day.')
    // }
    return startWeekDay as DayNumber
  }
}

export class Shift extends Interval {
  // the names of the courses the tutor is available to tutor
  // given in the ulc abbreviation and may contain input errors
  coursesGiven: string[] = []
  location: string

  constructor (event: Event, location: string) {
    // NOTE: we only need a single contructor now because EventWrapper
    //       is no longer an alias for a classless interval

    const startString = event.start?.dateTime
    const endString = event.end?.dateTime

    if (startString == null || endString == null) {
      throw new Error('Event has no start or end date/time.')
    }

    const startDateTime = new Date(startString)
    const endDateTime = new Date(endString)

    super(startDateTime, endDateTime)
    this.location = location
    this.parseCourses(event)
  }

  private parseCourses (event: Event): void {
    // sets this.coursesGiven to be the list of names we were given
    // if we want, we can do some input validation in here
    // this is what we currently have implemented
    const description = event.description
    if (description == null) {
      this.coursesGiven = []
      return
    }
    this.coursesGiven = description
      .split('-')[2]
      ?.split(',')
      .map((c) => c.trim())
      .filter((c) => c !== '')

    if (this.coursesGiven == null) {
      this.coursesGiven = []
    }

    // TODO: current edge cases that need to be covered
    //       no description (we could check the event name)
    //       M dashes, or better yet a mix of both
  }
}

// describes the schedule (of a specific course at a location)
// over the course of a day
export interface DailySchedule {
  weekDay: DayNumber
  intervals: Interval[]
}

// describes the schedule (of one specific course) for a given location
export interface LocationSchedule {
  location: string
  dailySchedules: DailySchedule[]
}

// describes the schedule for a given course across multiple locations
export interface CourseSchedule {
  course: Course
  locationSchedules: LocationSchedule[]
}

// an alias for an array of Course Schedules
// the response from POST /api/schedule will be of type Schedule
export type Schedule = CourseSchedule[]

enum ApiStatus {
  Success = 'success',
  Fail = 'fail',
  Error = 'error',
}

// if status is success or fail, data must exist
// if status is error, message must exist and data is optional
// schema borrowed from jsend: https://github.com/omniti-labs/jsend
interface ApiResponseInterface {
  status: ApiStatus
  data?: any
  message?: string
}

export class ApiSuccessResponse<T> implements ApiResponseInterface {
  status = ApiStatus.Success

  constructor (public data: T) {
    this.data = data
  }
}

// not currently used
export class ApiFailResponse implements ApiResponseInterface {
  status = ApiStatus.Fail

  constructor (public data: any) {
    this.data = data
  }
}

export class ApiErrorResponse implements ApiResponseInterface {
  status = ApiStatus.Error
  message: string

  constructor (error: string | Error, public data?: any) {
    if (error instanceof Error) {
      this.message = error.message
    } else {
      this.message = error
    }
  }
}

export interface ApiScheduleRequest {
  calendars: CalendarInfo[]
  stagingWeek: Date // date of week's Sunday
}

export interface User {
  uid: string
  name: string
  emails: string[]
  isAdmin: boolean
  isStudent: boolean
}
