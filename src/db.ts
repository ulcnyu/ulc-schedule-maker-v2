import mongoose, { Schema } from 'mongoose'
import { Course, User } from '../@types/scheduler'
import { v4 } from 'uuid'

const CourseSchema = new Schema<Course>({
  name: {
    type: String,
    required: true
  },
  supported: {
    type: Boolean,
    default: false,
    required: true
  },
  abbreviation: {
    type: String,
    required: false
  },
  department: {
    type: String,
    required: true
  },
  courseId: {
    type: String,
    required: true
  },
  school: {
    type: String,
    required: true
  },
  uid: {
    type: String,
    required: true,
    default: v4
  }
})

const UserSchema = new Schema<User>({
  uid: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  emails: {
    type: [String],
    required: true
  },
  isAdmin: {
    type: Boolean,
    required: true,
    default: false
  },
  isStudent: {
    type: Boolean,
    required: true,
    default: true
  }
})

mongoose.model('Course', CourseSchema)
mongoose.model('User', UserSchema)

mongoose.connect(process.env.MONGODB_URI ?? '', (err) => {
  console.log(err ?? '✅ Connected to MongoDB Atlas!')
})

export const CourseModel = mongoose.model<Course>('Course')
export const UserModel = mongoose.model<User>('User')
