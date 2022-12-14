import passport from 'passport'
import * as dotenv from 'dotenv'

import {
  GoogleCallbackParameters,
  Profile,
  Strategy as GoogleStrategy,
  VerifyCallback
} from 'passport-google-oauth20'

dotenv.config()

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      callbackURL: 'http://localhost:3001/google/callback', // TODO: this will change in prod
      scope: [
        'profile',
        'https://www.googleapis.com/auth/calendar.readonly'
      ],
      passReqToCallback: true
    },
    function verify (
      _req: Express.Request,
      accessToken: string,
      _refreshToken: string,
      _params: GoogleCallbackParameters,
      profile: Profile,
      done: VerifyCallback
    ) {
      return done(null, { profile, accessToken })
    }
  )
)

passport.serializeUser((user, done) => {
  process.nextTick(() => {
    done(null, user)
  })
})

passport.deserializeUser((user: Express.User, done) => {
  process.nextTick(() => {
    done(null, user)
  })
})
