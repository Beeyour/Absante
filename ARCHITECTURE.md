# Absante Architecture

Absante is a university lecture attendance system. The backend is FastAPI with SQLite. The frontend is React 18, Vite, React Router, and Tailwind CSS, with an Arabic RTL interface.

## Layers

```
React (student `/` · doctor `/doctor`)
        ↓  relative `/api/...`
FastAPI routers  →  UniversityAttendanceService  →  repositories  →  SQLite
```

- `app/main.py` — CORS from env, `/api` routers, optional SPA from `frontend/dist`
- `app/routers/` — `auth`, `student`, `doctor`
- `app/services.py` — attendance windows, roster, session timeline
- `app/repositories.py` — SQL
- `app/timeutil.py` — `APP_TIMEZONE` (default `Asia/Riyadh`)
- `frontend/src/services/api.ts` — all HTTP calls; never hardcode a host

## Routes and authorization

| Path | Audience | Gate |
|---|---|---|
| `/` | Student | Public |
| `/doctor/login` | Doctor | Password → token |
| `/doctor` | Doctor | Bearer token in `localStorage` |
| `/api/student/*` | Student | Public; no class roster |
| `/api/doctor/*` | Doctor | `Authorization: Bearer <token>` |
| `/api/auth/doctor/login` | Doctor | `DOCTOR_PASSWORD` |
| `/api/health` | Ops | Public |

Student check-in uses university ID, not internal row IDs. Student endpoints never return the full roster.

## API contract

All application APIs are under `/api`. The UI must call relative paths (`/api/...`). Optional `VITE_API_BASE_URL` is an origin only (no trailing slash), used when the UI is hosted on a different host.

### Auth

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| POST | `/api/auth/doctor/login` | `{ "password": string }` | `{ "access_token", "token_type": "bearer" }` | 401 |
| GET | `/api/auth/doctor/session` | Bearer | `{ "role": "doctor", "authenticated": true }` | 401 |

### Student

| Method | Path | Body / query | Success | Errors |
|---|---|---|---|---|
| GET | `/api/student/lectures` | — | `Lecture[]` (id, title, start_date, schedules) | — |
| GET | `/api/student/lectures/{id}` | — | One lecture, no students, plus `current_week_sessions` | 404 |
| POST | `/api/student/lectures/{id}/status` | `{ "student_id" }` | `{ lecture, student?, found, target_session? }` | 404 |
| POST | `/api/student/{lecture_id}/attend` | `{ "student_id" }` | `{ message, attended_at }` | 403 window, 404 |

### Doctor (Bearer required; 401 without token)

| Method | Path | Body / query | Success |
|---|---|---|---|
| GET | `/api/doctor/lectures` | — | `Lecture[]` |
| POST | `/api/doctor/lectures` | `{ title, start_date?, schedules[] }` | 201 `{ lecture_id }` |
| GET | `/api/doctor/lectures/{id}` | `?date=YYYY-MM-DD` | `{ lecture, students[], session_date }` |
| GET | `/api/doctor/lectures/{id}/sessions` | — | `{ sessions[], default_date, timezone }` |
| PUT | `/api/doctor/lectures/{id}` | `{ title?, start_date?, schedules? }` | `{ message }` |
| DELETE | `/api/doctor/lectures/{id}` | — | `{ message }` |
| POST | `/api/doctor/lectures/{id}/students` | `{ student_id, name }` | 201 |
| POST | `/api/doctor/lectures/{id}/students/bulk` | `{ students: [{ student_id, name }] }` | 201 |
| PUT | `/api/doctor/lectures/{id}/students/reorder` | `{ ordered_student_ids }` | `{ message }` |
| PUT | `/api/doctor/students/{student_db_id}` | `{ student_id?, name? }` | `{ message }` |
| DELETE | `/api/doctor/students/{student_db_id}` | — | `{ message }` |
| POST | `/api/doctor/students/{student_db_id}/attendance` | `{ is_present, session_date? }` | `{ message }` |

Validation failures return **422**. Duplicate university IDs in a lecture return **409**. Missing rows return **404**. Closed attendance window returns **403**.

`LectureSession`: `{ date, day_of_week, session_index, lecture_start_time, lecture_end_time, attendance_start_time, attendance_end_time }`.

Student `GET /api/student/lectures/{id}` adds `current_week_sessions`: the same fields plus `status` (`past` | `active` | `upcoming`) for occurrences in the current Sunday 00:00–Saturday 23:59 week in `APP_TIMEZONE`. `session_index` is the 1-based count from the lecture `start_date`.

Student `POST /api/student/lectures/{id}/status` includes `target_session`: `{ date, session_index, day_of_week, is_past }` where `day_of_week` is ISO (Monday = 0 … Sunday = 6). Attendance is resolved for today when that session is active or already ended; otherwise the latest past session (`lecture_end_time <= now`); otherwise the earliest upcoming session.

## Data model

- `lectures` — title, optional `start_date` (first lecture of the term, `YYYY-MM-DD`)
- `lecture_schedules` — weekday + lecture times + attendance window
- `students` — per lecture; unique `(lecture_id, student_id)`
- `attendance_records` — unique `(student_db_id, session_date)`

Attendance is one record per student per calendar day. Weekly slots on the same weekday share that date.

## Session timeline (`APP_TIMEZONE`)

`GET /api/doctor/lectures/{id}/sessions` builds dated occurrences from weekly schedules plus any stored attendance dates.

Range: the origin is the lecture `start_date` (clamped to at most 260 weeks back); without a `start_date` it falls back to 52 weeks back. The horizon is 26 weeks past today, and the list is capped at 500 sessions. `session_index` is anchored to the origin, so session 1 stays the term's first lecture.

Default `default_date`:

1. If now is inside the attendance window or the lecture period for today, select today.
2. Otherwise select the last session whose lecture end time is `<= now`.
3. If none exist yet, select the first upcoming session.

The doctor stepper navigates this list and reloads the roster with `?date=` and posts manual attendance with the same `session_date`.

## Frontend notes

- Student UI: `frontend/src/pages/StudentPortal.tsx`
- Doctor UI: `frontend/src/pages/DoctorApp.tsx`, stepper `frontend/src/components/SessionStepper.tsx`
- Token key: `absante_doctor_token`
- After `npm run build`, FastAPI serves `frontend/dist` when that folder exists.
