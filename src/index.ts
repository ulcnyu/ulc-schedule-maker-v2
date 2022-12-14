import express, {
  Express,
  Request,
  Response,
  NextFunction
} from 'express'
import path from 'path'
import mongoose from 'mongoose'
import passport from 'passport'
import session from 'express-session'
import * as dotenv from 'dotenv'
import cors from 'cors'
import fs from 'fs/promises'
import MongoStore from 'connect-mongo'

import './auth'
import { calendar_v3 } from '@googleapis/calendar'
import Event = calendar_v3.Schema$Event
import CalendarList = calendar_v3.Schema$CalendarListEntry
import { getClassSchedule } from './algo'
import {
  Interval,
  CalendarInfo,
  Schedule,
  ApiErrorResponse,
  CourseCatalog,
  Shift,
  CourseInfo,
  LocationSchedule,
  DailySchedule,
  CourseSchedule
} from '../@types/scheduler'

dotenv.config()

declare module 'express-session' {
  interface SessionData {
    accessToken: string
    destination: string
  }
}

const app: Express = express()
const port = process.env.PORT ?? 3001

function isLoggedIn (req: Request, res: Response, next: NextFunction): void {
  (req.user != null) ? next() : res.sendStatus(401)
}

app.use(express.static(path.join(__dirname, 'client/build')))
app.use(session({
  secret: process.env.SESSION_SECRET as string,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI as string
  })
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(express.json())
app.use(cors())

app.get('/', (_, res: Response) => {
  res.send('test')
})

app.get('/api/test', (_, res: Response) => {
  const test = {
    data: 'this is some data'
  }

  res.json(test)
})

app.get('/api/db_test', (_, res: Response) => {
  try {
    // Connect to the MongoDB cluster
    mongoose.connect(process.env.MONGODB_URI as string, () =>
      res.send('Mongoose is connected')
    )
  } catch (e) {
    res.send('could not connect')
  }
})

app.get('/login', (_, res) => {
  res.send("<a href='/auth/google'>Authenticate with Google</a>")
})

app.post('logout', (req, res, next) => {
  req.logout((err) => {
    if (err as boolean) {
      return next(err)
    }
    res.send('Goodbye!')
  })
})

app.get(
  '/api/auth/google',
  passport.authenticate('google', {
    scope: [
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar.readonly'
    ]
  })
)

app.get('/google/callback',
  passport.authenticate('google', {
    successRedirect: `${process.env.FE_URL ?? ''}/api/auth/successRedirect`,
    failureRedirect: '/auth/failure'
  }))

app.get('/api/auth/successRedirect', (req, res) => {
  req.session.accessToken = req.user?.accessToken
  req.session.save((err) => {
    if (err !== undefined && err !== null) {
      const errorMessage: string = err.toString()
      console.log(`Access Token not saved: ${errorMessage}`)
    }
  })
  res.redirect('/scheduler')
})

app.get('/api/protected', isLoggedIn, (req, res) => {
  const test = {
    name: req.user?.profile.displayName,
    accessToken: req.user?.accessToken
  }

  res.json(test)
})

app.get('/api/calendars', (req, res) => {
  void (async (req, res) => {
    // check if there's a user
    let accessToken = ''
    if (req.user != null) {
      accessToken = req.user.accessToken
    } else if (req.session.accessToken != null) {
      accessToken = req.session.accessToken
    } else {
      console.log('There is no session or user.') // TODO: make this redirect in front end
    }

    const url =
            'https://www.googleapis.com/calendar/v3/users/me/calendarList?access_token=' +
            accessToken

    // TODO: catch errors
    const rawData = await fetch(url, {
      method: 'GET'
    })

    // catch errors
    const responseStatus = rawData.status
    if (responseStatus >= 400) {
      if (responseStatus === 401) {
        // invalid credentials
        res.status(401)
        res.json(new ApiErrorResponse('Login failed. Invalid Credentials'))
        return
      } else if (responseStatus === 500) {
        // google server error
        res.status(500)
        res.json(new ApiErrorResponse('Google dun goofed.'))
        return
      }

      res.status(500)
      res.json(
        new ApiErrorResponse(
          'Unknown error while retrieving calendar events.'
        )
      )
      return
    }

    const data = await rawData.json()
    const calendarLists: CalendarList[] = data?.items ?? []

    const calendarInfos: CalendarInfo[] = calendarLists.map((calendarList) => {
      const calendarInfo: CalendarInfo = {
        id: calendarList.id ?? '',
        name: calendarList.summary ?? ''
      }
      return calendarInfo
    })

    res.json(calendarInfos)
  })(req, res)
})

app.get('/auth/failure', (_, res) => {
  res.status(403)
  res.json(
    new ApiErrorResponse(
      'Failed to log in. Navigate to /login and try again.'
    )
  )
})

function bin (
  courses: CourseCatalog,
  locations: string[],
  shifts: Shift[]
): Schedule {
  // create empty schedule
  const binnedSchedule: Schedule = []
  courses.forEach((course: CourseInfo) => {
    const courseSchedule: CourseSchedule = {
      courseInfo: course,
      locationSchedules: []
    }
    locations.forEach((location: string) => {
      const locationSchedule: LocationSchedule = {
        location,
        dailySchedules: []
      };
      [0, 1, 2, 3, 4, 5, 6].forEach((weekDay: number) => {
        locationSchedule.dailySchedules.push({
          weekDay: weekDay as 0 | 1 | 2 | 3 | 4 | 5 | 6,
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
            courseSchedule.courseInfo.matchScore(courseGiven) > 0.9
          ) // TODO: consider the matchString  threshold
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
        // TODO: can we just have shift.interval? maybe it doesn't need to extend
      }
    })
  })
  return binnedSchedule
}

async function getCourseCatalog (): Promise<CourseCatalog> {
  // returns the source of truth list of all courses
  // TODO: replace this with a real way to get the SOT
  try {
    const data = await fs.readFile('./courseCatalog.csv')
    const courseCatalog: CourseCatalog = []
    data.toString().split('\n').forEach((courseAbbreviation: string) => {
      courseCatalog.push(new CourseInfo(courseAbbreviation.trim()))
    })
    return courseCatalog
  } catch (e) {
    console.log(e)
    return []
  }
}

app.post('/api/schedule', (req, res) => {
  void (async (req, res) => {
    // check if there's a user
    let accessToken = ''
    if (req.user != null) {
      accessToken = req.user.accessToken
    } else if (req.session.accessToken != null) {
      accessToken = req.session.accessToken
    }

    const {
      calendars: calInfoList,
      stagingWeek
    }: { calendars: CalendarInfo[], stagingWeek: Date } = req.body

    const startTime = new Date(stagingWeek)
    const endTime = new Date(startTime)
    endTime.setDate(startTime.getDate() + 7)

    console.log(req.body)
    console.log(calInfoList)
    console.log(stagingWeek)

    const locations = calInfoList.map((calInfo: CalendarInfo) => calInfo.name)
    const courseCatalog: CourseCatalog = await getCourseCatalog()
    const allShifts: Shift[] = []

    for (const calId of calInfoList) {
      const { name, id }: { name: string, id: string } = calId

      const url =
                `https://www.googleapis.com/calendar/v3/calendars/${id}/events?` +
                `access_token=${accessToken}&` +
                `timeMin=${startTime.toISOString()}&` +
                `timeMax=${endTime.toISOString()}`

      const data = await fetch(url, {
        method: 'GET'
      })

      // catch errors
      const responseStatus = data.status
      if (responseStatus >= 400) {
        if (responseStatus === 401) {
          // invalid credentials
          res.status(401)
          res.json(
            new ApiErrorResponse(
              'Invalid Credentials. Navigate to /login and login through Google again.'
            )
          )
          return
        } else if (responseStatus === 404) {
          // invalid id error
          res.status(404)
          res.json(
            new ApiErrorResponse(
                            `${name} calendar not found. Double check that your calendars are not deleted.`
            )
          )
          return
        } else if (responseStatus === 500) {
          // google server error
          res.status(500)
          res.json(
            new ApiErrorResponse(
              'Google backend error. Please try again in a few minutes.'
            )
          )
          return
        }

        res.status(500)
        res.json(
          new ApiErrorResponse(
            'Unknown error while retrieving calendar events.'
          )
        )
        return
      }

      // TODO: change this any
      const eventJson: any = await data.json()
      const eventList: Event[] = eventJson.items

      eventList.forEach((event) => {
        if (event.status != null && event.status !== 'cancelled') { allShifts.push(new Shift(event, name)) }
      })
    }

    const schedule: Schedule = bin(courseCatalog, locations, allShifts)

    courseCatalog.forEach((courseInfo) => {
      locations.forEach((location) => {
        [0, 1, 2, 3, 4, 5, 6].forEach((weekDay) => {
          const courseSchedule = schedule.find((courseSchedule) => {
            return (
              courseSchedule.courseInfo.abbreviation ===
                            courseInfo.abbreviation
            )
          })
          if (courseSchedule == null) {
            return
          }
          const locationSchedule = courseSchedule.locationSchedules.find(
            (locationSchedule) => {
              return locationSchedule.location === location
            }
          )
          if (locationSchedule == null) {
            return
          }
          const dailySchedule = locationSchedule.dailySchedules.find(
            (dailySchedule) => {
              return dailySchedule.weekDay === weekDay
            }
          )
          if (dailySchedule != null) {
            dailySchedule.intervals = getClassSchedule(
              dailySchedule.intervals
            )
          }
        })
      })
    })

    res.json(schedule)
  })(req, res)
})

app.listen(port, () => {
  console.log(`??????[server]: Server is running at https://localhost:${port}`)
})
