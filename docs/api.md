# API Documentation

This document contains information about the endpoints supplied by the back-end of this application for developers working on the front-end. It is recommended that future changes to the API are reflected in this document.

## General Notes

All response bodies from the back-end are in JSON format and follow the [JSend](https://github.com/omniti-labs/jsend) schema. That is, we have two types of responses:

```typescript
ApiSuccessResponse {
    status: 'success'
    data: any
}
```

```typescript
ApiErrorResponse {
    status: 'error'
    message: string
    data: any (optional)
}
```

All responses with status code greater than or equal to 400 will be of type `ApiErrorResponse`, where the `message` field will contain a user-readable error message and the `data` field, if it exists, will contain relevant data. Generally, unknown API errors will send an `ApiErrorResponse` with a status code of 500. All `200 OK` responses are of type `ApiSuccessResponse` and contain relevant data in the `data` field.

For notes on resources and types, refer to [the types documentation](./types.md).

Also note that some `POST` endpoints require query parameters while others require request bodies. Take note of which endpoints take which before making the request.

## User Information Endpoints

### `GET /api/users`

Returns the information of all registered users.

The request requires no body or query parameters, but does require the user to have a valid session and to be an admin.

On success, sends an `ApiSusccessResponse` with data of type [`User[]`](types.md#User).

Response with status `401` will be sent if the user is not logged in or is not an admin.

### `GET /api/users/me`

Returns the information of the current session's user.

The request requires no body or query parameters, but does require a user to have a valid session.

On success, sends an `ApiSuccessResponse` with data of type [`User`](types.md#user).

Response with status `401` will be sent if the user is not logged in or otherwise does not have a valid session.

Response with status `500` will be sent if the current user cannot be found in the database. This should not be possible and should be investigated.

### `POST /api/users/admin`

Given a user's uid, sets the admin status of the user. If the new admin status is not specified, defaults to setting the user as an admin.

The request asks for the following query parameters.

```typescript
uid: string // the uid of the user whose status is set
isAdmin: boolean (optional) // the new admin status of the user. defaults to true
```

On success, sends an `ApiSuccessResponse` with data of type [`User`](types.md#user) corresponding to the specified user and their new admin status.

Response with status `401` will be sent if the user is not logged in or is not an admin.

## Course Catalog Endpoints

### `GET /api/course-catalog`

Returns an array of all the courses. If a query is provided, returns an array of all the courses that have names which contain the query as a substring.

The request requires no body or query parameters and does not require the user to be logged in or an admin.

The request asks for the following query parameter.

```typescript
query: string (optional) // the substring to match course names. if not provided, the endpoint responds with all courses.
```

On success, sends an `ApiSuccessResponse` with data of type [`CourseCatalog`](./types.md#course-catalog).

### `GET /api/course-catalog/supported`

Returns an array of all the courses that are marked as supported, that is all the courses that the ULC tutors.

The request requires no body or query parameters and does not require the user to be logged in or an admin.

On success, sends an `ApiSuccesResponse` with data of type [`CourseCatalog`](./types.md#course-catalog).

### `POST /api/course-catalog/add`

Adds a new course to the course catalog.

The request asks for a request body of type [`Course`](./types.md#course) though the `uid` property is not necessary as it will not become the uid of the course (and thus providing it is generally not recommended). That is:

```typescript
{
    name: string // the official name of the course
    school: string // the code of the school the course belongs to (eg UA, UB, UY etc)
    courseId: string // the id of the course (eg 101, 001, etc)
    department: string // the department the course belongs to (eg PSYCH, CSCI, MATH, etc)
    supported: boolean // whether or not the ULC provides support for this class
    abbreviation: string (optional) // the ULC nickname for the course
}
```

On success, sends an `ApiSuccessResponse` with data of type [`Course`](./types.md#course). Note that this includes the course's cannonical uid.

Response with status `400` will be sent if required fields are null or not a part of the body. The response data field will be of the form:

```typescript
{
    missingFields: string[] // the names of the fields that are missing
}
```

Response with status `401` will be sent if the user is not logged in or is not an admin.

### `POST /api/course-catalog/update`

Given a course with a specific uid, updates the course in the database with new course information specified in the request body.

The request requires a request body of type [`Course`](./types.md#course) though all fields but `uid` are optional. Fields not included will not be updated. That is:

```typescript
{
    uid: string // the uid of the course to be replaced
    name: string (optional) // the updated name of the course
    school: string (optional) // the updated school code
    courseId: string (optional) // the updated id of the course
    department: string (optional) // the updated department
    supported: boolean (optional) // the updated supported status of the school
    abbreviation: string (optional) // the updated ULC nickname for the course
}
```

On success, sends an `ApiSuccessResponse` with null data.

Response with status `400` will be sent if the request contains no uid.

Response with status `401` will be sent if the user is not logged in or is not an admin.

Response with status `404` will be sent if no course with the given uid exists in the database.

### `POST /api/course-catalog/support`

Given a course's uid, sets the supported status of the course. If the new supported status is not specified, defaults to setting the course as supported.

The request asks for the following query parameters.

```typescript
uid: string // the uid of the course
supported: boolean (optional) // the new supported status of the course. defaults to true
```

On success, sends an `ApiSuccessResponse` with null data.

Response with status `400` will be sent if the request contains no uid.

Response with status `401` will be sent if the user is not logged in or is not an admin.

Response with status `404` will be sent if no course with the given uid exists in the database.

### `DELETE /api/course-catalog`

Given a course's uid, deletes the course from the database.

The request asks for the following query parameters.

```typescript
uid: string // the uid of the course
```

On success, sends an `ApiSuccessResponse` with null data.

Response with status `400` will be sent if the request contains no uid.

Response with status `401` will be sent if the user is not logged in or is not an admin.

Response with status `404` will be sent if no course with the given uid exists in the database.

## Scheduling Endpoints

### `GET /api/calendars`

Returns the info about the calendars the user has in their Google Calendar.

The request requires no query parameters or body but does require the session to hold a valid google access token, and so the user must be logged in.

On success, sends an `ApiSuccessResponse` with data of type [`CalendarInfo[]`](./types.md#calendar-info). Note that in this instance, the name field represents the name of the calendar as given by Google.

Response with status `401` will be sent if the user is not logged in or if the user's access token is invalid.

Response with status `500` will be sent if Google sends a server error response, if Google sends an unknown error response, or if an unknown error occurs in this API. Check the error message for more details.

### `POST /api/schedule`

Returns the schedule in which supported classes are tutored at specific locations and days. Aggregates the shifts listed on the calendars provided and produces the intervals in which there is a shift covering each class.

The request requires the user is logged in, is an admin, and has a valid access token. This should be the case so long as the user is logged in as an admin. The request body should contain a field of type [`CalendarInfo[]`](./types.md#calendar-info) and a date to represent the start of the staging week. That is:

```typescript
{
    calendars: [
        {
            id: string // the Google id of the calendar
            name: string // the ULC location name (ie ARC, UHALL)
        }
    ],
    stagingWeek: Date // the date of the Sunday that starts the staging week 
}
```

On success, sends an `ApiSuccessResponse` with data of type [`Schedule`](./types#schedule).

Response with status `401` will be sent if the user is not logged in, if the user is not an admin, or if the user otherwise does not have a valid access token.

Response with status `404` will be sent if no calendar with a given id is found. This may occur if the user deletes a calendar after calling the `GET /api/calendars` endpoint whose id is used in the request to this endpoint.

Response with status `500` will be sent if Google sends a server error response, if Google sends an unknown error response, or if an unknown error occurs in this API. Check the error message for more details.
