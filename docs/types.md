# Types Documentation

This document contains information about the various types used both in the front-end and back-end developing of this app. Most type definitions and any provided implementations can be found in [@types/scheduler.ts](../%40types/scheduler.ts). It is recommended that future work to change type definitions are reflected in this document.

## Utility Types

### `User`

An object representing a user of our site. Contains information gathered from Google Authentication. This is not to be confused with `User` from the Express module which itself has a custom definition in [@types/express/index.d.ts](../%40types/express/index.d.ts).

```typescript
interface User {
  uid: string // the unique user id, currently taken from google
  name: string // the user's name
  emails: string[] // the user's emails
  isAdmin: boolean // the admin status of the user
  isStudent: boolean // the student status of the user
}
```

### `CalendarInfo`

Reduction of Google API's [`CalendarList`](https://developers.google.com/calendar/api/v3/reference/calendarList) resource that only contains the name of the calendar and its ID.

```typescript
interface CalendarInfo {
    id: string // Calendar id used in an api call to Google
    name: string // Either the name of the calendar on Google or the name of the ULC location
}
```

Note that depending on its usage, the `name` field can either represent the name of the calendar as provided on Google or the name of the ULC location, either ARC or UHall for the time being.

### `Course`

Container for all the information of a course including all logistical information such as its name and course id, a unique uid, its ULC-preferred abbreviation, and whether or not it is the ULC provides support for the course. It also has a method, `matchScore`, that gives a score to how well a given string matches the course. That is, the more likely a string is an actual string representation of this course, the higher the score will be.

```typescript
interface CourseInterface {
    supported: boolean // if the ulc provides tutoring for this class
    abbreviation: string | undefined // the ulc abbreviation. this should exist if the course is supported
    name: string // the official name of the course
    department: string // department code (CSCI, MATH, etc)
    courseId: string // course id in a department (101, 102, etc)
    school: string // school code (UA, UY, etc)
    uid: string // unique id of the course
    matchScore: (courseGiven: string) => number // calculates the likelihood a course given is this course
}
```

The `matchScore` method returns a number between 0 and 1 corresponding to the probability that a given course, such as the course name as given by a student's calendar description, actually is this particular course. The current implementation naively matches `courseGiven` to `abberviation` and returns 1 if that is the case and 0 otherwise. Future implementations may opt for a fuzzy-matching algorithm instead.

Generally, if `supported` is true, `abbreviation` should not be undefined, since all ULC supported courses should have a ULC preferred abbreviation.

### `CourseCatalogue`

A collection of courses that can represent all of our courses from a source of truth, or all supported courses.

```typescript
type CourseCatalog = CourseInfo[];
```

### `DayNumber`

A number union type that defines possible days of the week where 0 represents Sunday, 1 represents Monday, and so on. These number representations of weekdays is supported by JavaScript's Date API and Google Calendar's API.

```typescript
type DayNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6
```

### `Interval`

An object representing a range of time _on one specific day_. The current implementation sets the day of the week automatically from the `start` and `end` fields. If the interval of time stretches across multiple days of the week, the class will throw an error.

```typescript
interface IntervalInterface {
    start: Date
    end: Date
    readonly weekDay: DayNumber
}
```

For the current implementation, if the start and end times are on the same day in EST but in different days in UTC, getting `weekDay` will send an error. Furthermore, if the start and end day fall on the same day of the week but on different weeks, this unexpected case will not send an error. These behaviors should be addressed in future implementations.

### `Shift`

An object representing a ULC shift that contains information about the start time, end time, weekday, courses tutored, and location. The current implementation wraps around the Google [`Event`](https://developers.google.com/calendar/api/v3/reference/events) and does not guarantee that the courses given are correctly formatted as the valid course abbreviation or name.

```typescript
export class Shift extends Interval {
  coursesGiven: string[] = [] // the names of the courses the tutor is available to tutor
  location: string // the ulc name of the location the shift is at (ie UHall, ARC)
  start: Date // see Interval
  end: Date // see Interval
  readonly weekDay: DayNumber // see Interval
}
```

## Schedule Types

### `DailySchedule`

Describes the schedule (of a specific course at a location) over the course of a day of the week

```typescript
interface DailySchedule {
    weekDay: DayNumber // the day of the week the schedule is for
    intervals: Intervals[] // the intervals the course is tutored at this location on this day
}
```

### `LocationSchedule`

Describes the schedule of one specific course for a given location over every day of the week.

```typescript
interface LocationSchedule {
    location: string // the ULC name of the location (eg ARC, UHall)
    dailySchedules: DailySchedule[] // the schedules for each day the course is tutored at this lcoation
}
```

### `CourseSchedule`

Describes the schedule for a given course across multiple locations and all days of the week.

```typescript
interface CourseSchedule {
    course: Course // the information about the course being tutored
    locationSchedules: LocationSchedule[] // the schedules for each location for this course
}
```

### `Schedule`

An alias for an array of `CourseSchedule`. Represents an overall schedule for the ULC.

```typescript
type Schedule = CourseSchedule[];
```

## API Response Types

### `ApiSuccessResponse`

Represents a successful response from the API to send to the front-end.

```typescript
class ApiSuccessResponse<T> implements ApiResponseInterface {
    status: "success",
    data?: T
}
```

### `ApiErrorResponse`

Represents an error response from the API to send to the front-end. Our current implementation uses it to send any fail or error message.

```typescript
class ApiErrorResponse implements ApiResponseInterface {
    status: "error",
    message: string,
    data?: any
}
```

### `ApiFailResponse`

Represents a failure response from the API to send to the front-end. This implies that there was ["a problem with the data submitted, or some pre-condition of the API call wasn't satisfied"](https://github.com/omniti-labs/jsend#so-how-does-it-work).

```typescript
class ApiFailResponse implements ApiResponseInterface {
    status: "fail",
    data?: any
}
```

This is currently unused, though the implementation does exist.

### `ApiScheduleRequest`

The type of the body sent to the [`POST /api/schedule`](./api.md#get-apischedule) endpoint.

```typescript
interface ApiScheduleRequest {
    calendars: CalendarInfo[] // the information about the calendars to base the schedule on
    stagingWeek: Date // date of the staging week's Sunday
}
```
