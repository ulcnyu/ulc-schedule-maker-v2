import express, {
  Express,
  Request,
  Response,
  NextFunction
} from 'express'
import path from 'path'
import session from 'express-session'
import * as dotenv from 'dotenv'
import cors from 'cors'
import passport from 'passport'
import { Error } from 'mongoose'
import MongoStore from 'connect-mongo'

import { calendar_v3 } from '@googleapis/calendar'
import Events = calendar_v3.Schema$Events
import Event = calendar_v3.Schema$Event
import CalendarList = calendar_v3.Schema$CalendarListEntry

import {
  CalendarInfo,
  Schedule,
  ApiErrorResponse,
  CourseCatalog,
  Shift,
  Course,
  ApiSuccessResponse,
  User as ScheduleUser
} from '../@types/scheduler'
import './auth'
import { getClassSchedule, bin } from './algo'
import { CourseModel, UserModel as ScheduleUserModel } from './db'

dotenv.config()

declare module 'express-session' {
  interface SessionData {
    accessToken: string
    user: ScheduleUser
  }
}

const app: Express = express()
const port = process.env.PORT ?? 3001

// -------------------------- MIDDLEWARE ---------------------------------

function isLoggedIn (req: Request, res: Response, next: NextFunction): void {
  if (req.session.user == null) {
    res.status(401)
    res.json(new ApiErrorResponse('User is not logged in.'))
    return
  }
  next()
}

function isAdmin (req: Request, res: Response, next: NextFunction): void {
  (async (req, res) => {
    if (req.session.user == null) {
      res.status(401)
      res.json(new ApiErrorResponse('User is not logged in.'))
      return
    }

    // check for changes to admin status in the database in case changes have happened while seession is active
    req.session.user = await ScheduleUserModel.findOne<ScheduleUser>({ uid: req.session.user.uid }, { _id: 0, __v: 0 }) ?? req.session.user
    req.session.save()

    if (!req.session.user.isAdmin) {
      res.status(403)
      res.json(new ApiErrorResponse('User is not an admin.'))
      return
    }

    next()
  })(req, res).catch((err) => {
    console.log(err)
    res.status(500)
    res.json(new ApiErrorResponse('Unknown database error while checking if user is admin'))
  })
}

app.use(express.static(path.join(__dirname, 'client/build')))
app.use(session({
  resave: false,
  saveUninitialized: false,
  secret: process.env.SESSION_SECRET as string,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI as string,
    autoRemove: 'interval',
    autoRemoveInterval: 3600
  })
}))
app.use(express.json())
app.use(passport.initialize())
app.use(passport.session())
app.use(cors())

// ------------------------------- AUTHORIZATION AND AUTHENTICATION ENDPOINTS ---------------------------

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err as boolean) {
      console.log(err)
      res.status(500)
      res.json(new ApiErrorResponse('Error logging out.'))
      return
    }
    res.json(new ApiSuccessResponse(null))
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
    failureRedirect: '/api/auth/failure'
  })
)

app.get('/api/auth/successRedirect', (req, res) => {
  (async (req, res) => {
    if (req.user == null) {
      res.status(500)
      res.json(new ApiErrorResponse('User object not saved.'))
      return
    }

    // register user
    const emails: string[] = req.user.profile.emails?.filter((email) => email.verified).map((email) => email.value) ?? []
    const user = await ScheduleUserModel.findOneAndUpdate<ScheduleUser>({ uid: req.user.profile.id }, {
      name: req.user.profile.displayName,
      emails
    }, {
      upsert: true,
      setDefaultsOnInsert: true,
      new: true
    })

    // save access token to session
    req.session.accessToken = req.user.accessToken
    req.session.user = user
    req.session.save()

    res.redirect('/scheduler')
  })(req, res).catch((err) => {
    console.log(err)
    res.status(500)
    res.json(new ApiErrorResponse('Unknown server error while handling authentication.'))
  })
})

app.get('/api/auth/failure', (req, res) => {
  res.status(403)
  res.json(new ApiErrorResponse('Failed to log in. Navigate to /login and try again.'))
})

// ---------------------------------- USER INFORMATION ENDPOINTS ------------------------------

app.get('/api/users/me', isLoggedIn, (req, res) => {
  (async (req, res) => {
    const user = await ScheduleUserModel.findOne<ScheduleUser>({ uid: req.session.user?.uid }, { _id: 0, __v: 0 })

    if (user == null) {
      console.log(`User with uid ${req.session.user?.uid ?? '<NO UID FOUND>'} found in database.`)
      res.status(500)
      res.json(new ApiErrorResponse('Current user not found.'))
      return
    }

    res.json(new ApiSuccessResponse(user))
  })(req, res).catch((err) => {
    console.log(err)
    res.status(500)
    res.json(new ApiErrorResponse('Unknown database error'))
  })
})

app.post('/api/users/admin', isAdmin, (req, res) => {
  (async (req, res) => {
    if (req.query.uid == null) {
      res.status(400)
      res.json(new ApiErrorResponse('No uid provided. Please provide a uid.'))
      return
    }
    const isAdmin = req.query.isAdmin ?? true
    const user = await ScheduleUserModel.findOneAndUpdate<ScheduleUser>({ uid: req.query.uid }, { isAdmin }, { new: true })

    if (user == null) {
      res.status(404)
      res.json(new ApiErrorResponse('User with this uid not found. Please try a different uid.'))
      return
    }

    res.json(new ApiSuccessResponse(user))
  })(req, res).catch((err) => {
    console.log(err)
    res.status(500)
    res.json(new ApiErrorResponse('Unknown error while adding admin'))
  })
})

app.get('/api/users', isAdmin, (req, res) => {
  (async (req, res) => {
    const users = await ScheduleUserModel.find<ScheduleUser>({})
    res.json(new ApiSuccessResponse(users))
  })(req, res).catch((err) => {
    console.log(err)
    res.status(500)
    res.json(new ApiErrorResponse('Unknown error while getting users'))
  })
})

// ----------------------------- COURSE CATALOG ENDPOINTS -----------------------------

app.get('/api/course-catalog/supported', (req, res) => {
  (async (req, res) => {
    res.json(new ApiSuccessResponse(await getSupportedCourseCatalog()))
  })(req, res)
    .catch((err) => {
      console.log(err)
      res.status(500)
      res.json(new ApiErrorResponse('Unknown database error'))
    })
})

app.get('/api/course-catalog', (req, res) => {
  (async (req, res) => {
    const query = req.query.query ?? ''
    const courses: Course[] = await CourseModel.find({ name: { $regex: query, $options: 'i' } }, { _id: 0, __v: 0 })
    res.json(new ApiSuccessResponse(courses))
  })(req, res)
    .catch((err) => {
      console.log(err)
      res.status(500)
      res.json(new ApiErrorResponse('Unknown database error'))
    })
})

app.post('/api/course-catalog/add', isAdmin, (req, res) => {
  (async (req, res) => {
    const newCourse = new Course(
      req.body.name,
      req.body.school,
      req.body.courseId,
      req.body.department,
      req.body.supported,
      req.body.abbreviation
    )
    await CourseModel.create(newCourse)
    res.json(new ApiSuccessResponse(newCourse))
  })(req, res)
    .catch((err) => {
      if (err instanceof Error.ValidationError) {
        const missingFields: string[] = Object.getOwnPropertyNames(err.errors)
        res.status(400)
        res.json(new ApiErrorResponse(`The following fields are missing: ${missingFields.join(', ')}`, { missingFields }))
        return
      }
      console.log(err)
      res.status(500)
      res.json(new ApiErrorResponse('Unknown database error'))
    })
})

app.post('/api/course-catalog/support', isAdmin, (req, res) => {
  (async (req, res) => {
    if (req.query.uid == null) {
      res.status(400)
      res.json(new ApiErrorResponse('Please supply a course uid.'))
      return
    }

    const newSupported = req.query.supported ?? true
    const updatedDoc = await CourseModel.findOneAndUpdate<Course>({ uid: req.query.uid }, { supported: newSupported })

    if (updatedDoc == null) {
      res.status(404)
      res.json(new ApiErrorResponse('No course exists with this uid. Please try another one.'))
      return
    }

    res.json(new ApiSuccessResponse(null))
  })(req, res)
    .catch((err) => {
      console.log(err)
      res.status(500)
      res.json(new ApiErrorResponse('Unknown database error'))
    })
})

app.post('/api/course-catalog/update', isAdmin, (req, res) => {
  (async (req, res) => {
    if (req.body.uid == null) {
      res.status(400)
      res.json(new ApiErrorResponse('Please supply a Course object with a uid.'))
      return
    }

    const updatedDoc = await CourseModel.findOneAndUpdate<Course>({ uid: req.body.uid }, { ...req.body })

    if (updatedDoc == null) {
      res.status(404)
      res.json(new ApiErrorResponse('No course exists with this uid. Please try another one.'))
      return
    }

    res.json(new ApiSuccessResponse(null))
  })(req, res)
    .catch((err) => {
      console.log(err)
      res.status(500)
      res.json(new ApiErrorResponse('Unknown database error'))
    })
})

app.delete('/api/course-catalog', isAdmin, (req, res) => {
  (async (req, res) => {
    if (req.query.uid == null) {
      res.status(400)
      res.json(new ApiErrorResponse('Please supply a uid.'))
      return
    }

    const updatedDoc = await CourseModel.findOneAndDelete<Course>({ uid: req.query.uid })

    if (updatedDoc == null) {
      res.status(404)
      res.json(new ApiErrorResponse('No course exists with this uid. Please try another one.'))
      return
    }

    res.json(new ApiSuccessResponse(null))
  })(req, res)
    .catch((err) => {
      console.log(err)
      res.status(500)
      res.json(new ApiErrorResponse('Unknown database error'))
    })
})

// ----------------------------------- SCHEDULING ENDPOINTS -----------------------------------

async function getSupportedCourseCatalog (): Promise<CourseCatalog> {
  // returns the source of truth list of all courses
  try {
    const supportedCourses: Course[] = await CourseModel.find<Course>({ supported: true }, { _id: 0, __v: 0 })
    return supportedCourses.map((course) => {
      return new Course(course.name, course.school, course.courseId, course.department, course.supported, course.abbreviation, course.uid)
    })
  } catch (e) {
    console.log(e)
    return []
  }
}

app.get('/api/calendars', isLoggedIn, (req, res) => {
  (async (req, res) => {
    const accessToken = req.session.accessToken ?? ''
    const url =
            'https://www.googleapis.com/calendar/v3/users/me/calendarList?access_token=' +
            accessToken

    const rawData = await fetch(url, {
      method: 'GET'
    })

    // catch errors
    const responseStatus = rawData.status

    if (responseStatus === 401) {
      // invalid credentials
      res.status(401)
      res.json(new ApiErrorResponse('Login failed. Invalid Credentials'))
      return
    }

    if (responseStatus === 500) {
      // google server error
      res.status(500)
      res.json(new ApiErrorResponse('Google dun goofed.'))
      return
    }

    if (responseStatus >= 400) {
      res.status(500)
      res.json(new ApiErrorResponse('Unknown error while retrieving calendar events.'))
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
    .catch((err) => {
      console.log(err)
      res.status(500)
      res.json(new ApiErrorResponse('Unknown server error.'))
    })
})

app.post('/api/schedule', isAdmin, (req, res) => {
  (async (req, res) => {
    let accessToken = ''
    if (req.user != null) {
      accessToken = req.user.accessToken
    } else if (req.session.accessToken != null) {
      accessToken = req.session.accessToken
    }

    // TODO: catch malformed inputs

    const {
      calendars: calInfoList,
      stagingWeek
    }: { calendars: CalendarInfo[], stagingWeek: Date } = req.body

    const startTime = new Date(stagingWeek)
    const endTime = new Date(startTime)
    endTime.setDate(startTime.getDate() + 7)

    const locations = calInfoList.map((calInfo: CalendarInfo) => calInfo.name)
    const courseCatalog: CourseCatalog = await getSupportedCourseCatalog()
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

      if (responseStatus === 401) {
        // invalid credentials
        res.status(401)
        res.json(new ApiErrorResponse('Invalid Credentials. Navigate to /login and login through Google again.'))
        return
      }

      if (responseStatus === 404) {
        // invalid id error
        res.status(404)
        res.json(new ApiErrorResponse(`${name} calendar not found. Double check that your calendars are not deleted.`))
        return
      }

      if (responseStatus === 500) {
        // google server error
        res.status(500)
        res.json(new ApiErrorResponse('Google backend error. Please try again in a few minutes.'))
        return
      }

      if (responseStatus >= 400) {
        res.status(500)
        res.json(new ApiErrorResponse('Unknown error while retrieving calendar events.'))
        return
      }

      const eventJson: Events = await data.json()
      const eventList: Event[] = eventJson.items ?? []

      eventList.forEach((event) => {
        if (event.status != null && event.status !== 'cancelled') { allShifts.push(new Shift(event, name)) }
      })
    }

    const schedule: Schedule = bin(courseCatalog, locations, allShifts)

    courseCatalog.forEach((course) => {
      locations.forEach((location) => {
        [0, 1, 2, 3, 4, 5, 6].forEach((weekDay) => {
          const courseSchedule = schedule.find((courseSchedule) => {
            return (
              courseSchedule.course.abbreviation ===
                            course.abbreviation
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
    .catch((err) => {
      console.log(err)
      res.status(500)
      res.json(new ApiErrorResponse('Unknown server error. Please contact ULC developers.'))
    })
})

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`)
})
