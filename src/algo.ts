import {
  Course,
  CourseCatalog,
  CourseSchedule,
  DailySchedule,
  DayNumber,
  Interval,
  LocationSchedule,
  Schedule,
  Shift
} from '../@types/scheduler'

export function bin (courses: CourseCatalog, locations: string[], shifts: Shift[]): Schedule {
  // create empty schedule
  const binnedSchedule: Schedule = []
  courses.forEach((course: Course) => {
    const courseSchedule: CourseSchedule = {
      course,
      locationSchedules: []
    }
    locations.forEach((location: string) => {
      const locationSchedule: LocationSchedule = {
        location,
        dailySchedules: []
      };
      [0, 1, 2, 3, 4, 5, 6].forEach((weekDay: number) => {
        locationSchedule.dailySchedules.push({
          weekDay: weekDay as DayNumber,
          intervals: []
        })
      })
      courseSchedule.locationSchedules.push(locationSchedule)
    })
    binnedSchedule.push(courseSchedule)
  })

  // populate the schedule with the relevant intervals
  shifts.forEach((shift: Shift) => {
    shift.coursesGiven.forEach((courseGiven: string) => {
      const relevantCourseSchedule = binnedSchedule.find(
        (courseSchedule: CourseSchedule) => {
          return (
            courseSchedule.course.matchScore(courseGiven) > 0.9
          ) // TODO: consider the matchString threshold
        }
      )
      if (relevantCourseSchedule == null) {
        return
      }
      const relevantLocationSchedule =
                relevantCourseSchedule.locationSchedules.find(
                  (locationSchedule: LocationSchedule) => {
                    return shift.location === locationSchedule.location
                  }
                )
      if (relevantLocationSchedule == null) {
        return
      }
      const relevantDailySchedule =
                relevantLocationSchedule.dailySchedules.find(
                  (dailySchedule: DailySchedule) => {
                    return shift.weekDay === dailySchedule.weekDay
                  }
                )
      if (relevantDailySchedule != null) {
        relevantDailySchedule.intervals.push(
          new Interval(shift.start, shift.end)
        )
      }
    })
  })
  return binnedSchedule
}

export function getClassSchedule (intervals: Interval[]): Interval[] {
  if (intervals.length === 0) {
    return []
  }
  const intervalsClone = intervals.slice()
  intervalsClone.sort(
    (ew1, ew2) => ew1.start.getTime() - ew2.start.getTime()
  )
  return getClassScheduleRec(intervalsClone)
}

/*
/   Constructs a list of the longest interval(s) for which a course is tutored for.
/   Recurses on the remaining elements of the list after one contiguous interval
/   is constructed to append remaining interval(s). Base case is reached when no
/   elements are left.
/
/   @param A list of Interval objects corresponding to a course on a specific day
/   sorted by start time in ascending order. Must be nonempty
/
/   @return A list of Interval objects that contain start and end times (Date objects)
/   of the schedule interval(s) pertaining to a specific course.
*/
function getClassScheduleRec (intervals: Interval[]): Interval[] {
  let end: Date = intervals[0].end // assumes list is non-empty
  const start: Date = intervals[0].start

  while (intervals.length > 0) {
    const curEvent = intervals.shift()
    if (curEvent == null) {
      break
    }
    const curStart = curEvent?.start
    const curEnd = curEvent?.end

    if (!((curStart != null) && (curEnd != null))) {
      throw new Error('Event missing start or end')
    }

    if (start.getTime() === curStart?.getTime() && end < curEnd) {
      end = curEnd
    } else if (curStart <= end && end < curEnd) {
      end = curEnd
    } else if (curStart > end) {
      intervals.unshift(curEvent)
      break
    }
  }

  let returnedIntervals: Interval[] = [new Interval(start, end)]

  if (intervals.length !== 0) {
    returnedIntervals = returnedIntervals.concat(
      getClassScheduleRec(intervals)
    )
  }

  return returnedIntervals
}
