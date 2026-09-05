# Agent guidelines — Absante

Read `ARCHITECTURE.md` before changing behavior. Keep student `/` and doctor `/doctor` separate. Do not merge the two portals.

## API URLs

- Never hardcode `localhost`, `127.0.0.1`, or an absolute public host in application code.
- Browser calls must use relative paths: `/api/...`.
- `getApiBase()` may prepend `VITE_API_BASE_URL` (origin only) when the UI is on another host. Default is empty so same-origin deploy works.
- Vite proxy `/api` is for local `npm run dev` only; it is not a substitute for relative URLs in source.

## Privacy

- Student APIs and UI must not expose the class roster or other students’ attendance.
- Check-in and status use university `student_id`, not enumerable internal IDs on the public portal.
- Doctor roster, import, edit, reorder, and manual attendance stay behind Bearer auth.

## Time

- Attendance windows and the lecture stepper default session use server `APP_TIMEZONE` (default `Asia/Riyadh`), not the browser clock.
- Manual attendance must send the stepper’s `session_date`.

## After changes

```bash
cd frontend && npm run build
.venv/bin/pytest
```

Doctor password and `SECRET_KEY` come from `.env`. Do not commit secrets.
