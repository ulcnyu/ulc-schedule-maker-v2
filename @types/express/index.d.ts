import { Profile } from 'passport-google-oauth20'

declare global {
  namespace Express {
    export interface User {
      profile: Profile
      accessToken: string
    }
  }
}
