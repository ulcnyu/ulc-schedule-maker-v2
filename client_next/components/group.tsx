import { Disclosure } from '@headlessui/react'
import { CourseSchedule } from '../../@types/scheduler'
import { FaChevronDown, FaChevronUp } from 'react-icons/fa'
import CopyButton from './copy-button'

interface Props {
  course: CourseSchedule
}

const Group: React.FC<Props> = ({ course: schedule }) => {
  interface LocationString {
    location: string
    schedule: Array<JSX.Element | null>
    scheduleString: string
  }

  const dayMap = new Map<number, string>([
    [0, 'Sunday'],
    [1, 'Monday'],
    [2, 'Tuesday'],
    [3, 'Wednesday'],
    [4, 'Thursday'],
    [5, 'Friday'],
    [6, 'Saturday']
  ])

  const courseName = schedule.course.abbreviation

  const locationStrings: LocationString[] = schedule.locationSchedules.map(
    (ls) => {
      const scheduleBlock = ls.dailySchedules.map((ds, index) => {
        const intervalString = ds.intervals.reduce(
          (prev: string, curr: Interval) => {
            const startString = new Date(curr.start).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })
            const endString = new Date(curr.end).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })

            return prev + `${startString} - ${endString}; `
          },
          ''
        )

        return intervalString !== ''
          ? (
          <li key={index}>
            {dayMap.get(ds.weekDay)}: {intervalString}
          </li>
            )
          : null
      })

      const scheduleString = ls.dailySchedules.reduce((prev, curr) => {
        const intervalString = curr.intervals.reduce(
          (prev: string, curr: Interval) => {
            const startString = new Date(curr.start).toLocaleTimeString()
            const endString = new Date(curr.end).toLocaleTimeString()

            return prev + `${startString} - ${endString}; `
          },
          ''
        )

        return intervalString !== '' && dayMap.get(curr.weekDay) !== undefined
          ? prev + `${dayMap.get(curr.weekDay)}: ${intervalString} \n`
          : prev + ''
      }, '')

      return {
        location: ls.location,
        schedule: scheduleBlock,
        scheduleString
      }
    }
  )

  const locationS = locationStrings.reduce(
    (prev: string, curr: LocationString, index) => {
      const newString = `${curr.location} \n ${curr.scheduleString}`
      if (curr.scheduleString === '') {
        return prev
      }
      return prev + newString
    },
    ''
  )

  const locationJsx = locationStrings.reduce(
    (prev: JSX.Element, curr: LocationString, index) => {
      let newJsx = (
        <div key={index} className={index !== 0 ? 'mt-2 md:mt-0' : ''}>
          <h3 className="font-bold">{curr.location}</h3>
          <ul>{curr.schedule}</ul>
        </div>
      )

      const hasValid = curr.schedule.reduce((prev, curr) => {
        if (curr !== null) {
          return true
        }
        return prev
      }, false)

      if (!hasValid) {
        newJsx = <></>
      }

      return (
        <>
          {prev}
          {newJsx}
        </>
      )
    },
    <></>
  )

  return (
    <>
      <Disclosure key={courseName} as="div" defaultOpen={true}>
        {({ open }) => (
          <>
            <Disclosure.Button className="flex w-full justify-between rounded-lg bg-purple-100 px-4 py-2 text-left text-sm font-medium text-purple-900 hover:bg-purple-200 focus:outline-none focus-visible:ring focus-visible:ring-purple-500 focus-visible:ring-opacity-75">
              <span>{courseName}</span>
              <span className="my-auto">
                {open ? <FaChevronUp /> : <FaChevronDown />}
              </span>
            </Disclosure.Button>
            <Disclosure.Panel className="px-4 pt-2 pb-2 text-sm text-gray-500 grid grid-cols-1 md:grid-cols-2 relative">
              {locationJsx}
              <div className='absolute top-2 right-0'>
                <CopyButton copyText={locationS}></CopyButton>
              </div>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
    </>
  )
}

export default Group
