import sqlite3
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status

from app.config import get_settings
from app.repositories import (
    AttendanceRepository,
    LectureRepository,
    StudentRepository,
)
from app.schemas import LectureCreate, LectureUpdate, StudentCreate, StudentUpdate
from app.timeutil import (
    academic_week_bounds,
    attendance_window_state,
    build_lecture_sessions,
    iso_weekday,
    now_in_timezone,
    pick_default_session_date,
    pick_student_status_session,
    public_session_fields,
    session_runtime_status,
)


def _conflict_or_raise(exc: sqlite3.IntegrityError) -> None:
    message = str(exc).lower()
    if "unique" in message or "idx_students_unique_sid" in message:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A student with this university ID already exists in the lecture.",
        ) from exc
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Could not save the record.",
    ) from exc


def current_week_sessions_for_lecture(
    lecture: Dict[str, Any],
    now: datetime,
    timezone_name: str,
) -> List[Dict[str, Any]]:
    """Dated schedule occurrences for the current Sunday–Saturday week.

    `session_index` is the 1-based global count from the lecture `start_date`
    (or the timeline origin when no start date is set). Status is evaluated
    against `now` in `timezone_name`.
    """
    sessions = build_lecture_sessions(
        lecture.get("schedules") or [],
        now,
        timezone_name=timezone_name,
        start_date=lecture.get("start_date"),
    )
    week_start, week_end = academic_week_bounds(now)
    week_sessions: List[Dict[str, Any]] = []
    for item in sessions:
        session_date = date.fromisoformat(item["date"])
        if session_date < week_start or session_date > week_end:
            continue
        payload = public_session_fields(item)
        payload["status"] = session_runtime_status(item, now)
        week_sessions.append(payload)
    return week_sessions


class UniversityAttendanceService:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn
        self.lecture_repo = LectureRepository(conn)
        self.student_repo = StudentRepository(conn)
        self.attendance_repo = AttendanceRepository(conn)
        self.settings = get_settings()

    def _now(self):
        return now_in_timezone(self.settings.app_timezone)

    def list_all_lectures(self) -> List[Dict[str, Any]]:
        return self.lecture_repo.list_all()

    def get_public_lecture(self, lecture_id: int) -> Dict[str, Any]:
        lecture = self.lecture_repo.get_by_id(lecture_id)
        if not lecture:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found."
            )
        public = dict(lecture)
        public["current_week_sessions"] = current_week_sessions_for_lecture(
            lecture, self._now(), self.settings.app_timezone
        )
        return public

    def get_lecture_sessions(self, lecture_id: int) -> Dict[str, Any]:
        lecture = self.lecture_repo.get_by_id(lecture_id)
        if not lecture:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found."
            )
        now = self._now()
        extra_dates = self.attendance_repo.list_session_dates_for_lecture(lecture_id)
        sessions = build_lecture_sessions(
            lecture["schedules"],
            now,
            extra_dates=extra_dates,
            timezone_name=self.settings.app_timezone,
            start_date=lecture.get("start_date"),
        )
        public_sessions = [
            {key: value for key, value in item.items() if key != "ends_at"}
            for item in sessions
        ]
        return {
            "sessions": public_sessions,
            "default_date": pick_default_session_date(
                sessions, lecture["schedules"], now
            ),
            "timezone": self.settings.app_timezone,
        }

    def get_lecture_roster(
        self, lecture_id: int, target_date: Optional[str] = None
    ) -> Dict[str, Any]:
        lecture = self.lecture_repo.get_by_id(lecture_id)
        if not lecture:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found."
            )

        query_date = target_date or self._now().strftime("%Y-%m-%d")
        students = self.student_repo.get_roster_with_attendance(lecture_id, query_date)
        return {"lecture": lecture, "students": students, "session_date": query_date}

    def get_student_self_status(
        self, lecture_id: int, student_id: str
    ) -> Dict[str, Any]:
        lecture = self.get_public_lecture(lecture_id)
        now = self._now()
        today = now.strftime("%Y-%m-%d")
        sessions = build_lecture_sessions(
            lecture["schedules"],
            now,
            timezone_name=self.settings.app_timezone,
            start_date=lecture.get("start_date"),
        )
        student_today = self.student_repo.get_status_with_attendance(
            lecture_id, student_id, today
        )
        target = pick_student_status_session(
            sessions,
            lecture["schedules"],
            now,
            today_is_present=bool(student_today and student_today.get("is_present")),
        )
        target_date = target["date"] if target else today
        if target_date == today:
            student = student_today
        else:
            student = self.student_repo.get_status_with_attendance(
                lecture_id, student_id, target_date
            )

        target_session = None
        if target:
            session_day = date.fromisoformat(target["date"])
            target_session = {
                "date": target["date"],
                "session_index": target["session_index"],
                "day_of_week": iso_weekday(session_day),
                "is_past": target["ends_at"] <= now,
            }

        return {
            "lecture": lecture,
            "student": student,
            "found": student is not None,
            "target_session": target_session,
        }

    def create_lecture(self, payload: LectureCreate) -> int:
        if not payload.schedules:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one weekly schedule must be configured.",
            )
        with self.conn:
            schedules_data = [s.model_dump() for s in payload.schedules]
            return self.lecture_repo.create(
                payload.title.strip(),
                schedules_data,
                payload.start_date.isoformat() if payload.start_date else None,
            )

    def update_lecture(self, lecture_id: int, payload: LectureUpdate) -> None:
        if not self.lecture_repo.get_by_id(lecture_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found."
            )

        schedules_data = None
        if payload.schedules is not None:
            if not payload.schedules:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="At least one weekly schedule must be configured.",
                )
            schedules_data = [s.model_dump() for s in payload.schedules]

        title = payload.title.strip() if payload.title is not None else None
        start_date = payload.start_date.isoformat() if payload.start_date else None
        with self.conn:
            self.lecture_repo.update(lecture_id, title, schedules_data, start_date)

    def delete_lecture(self, lecture_id: int) -> None:
        if not self.lecture_repo.get_by_id(lecture_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found."
            )
        with self.conn:
            self.lecture_repo.delete(lecture_id)

    def add_student_to_lecture(self, lecture_id: int, payload: StudentCreate) -> int:
        if not self.lecture_repo.get_by_id(lecture_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found."
            )
        try:
            with self.conn:
                next_order = self.student_repo.get_max_sort_order(lecture_id) + 1
                return self.student_repo.create(
                    lecture_id=lecture_id,
                    student_id=payload.student_id,
                    name=payload.name,
                    sort_order=next_order,
                )
        except sqlite3.IntegrityError as exc:
            _conflict_or_raise(exc)
            raise

    def bulk_add_students(self, lecture_id: int, students: List[StudentCreate]) -> None:
        if not self.lecture_repo.get_by_id(lecture_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found."
            )
        if not students:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide at least one student.",
            )
        try:
            with self.conn:
                start_order = self.student_repo.get_max_sort_order(lecture_id) + 1
                students_data = [s.model_dump() for s in students]
                self.student_repo.bulk_create(lecture_id, students_data, start_order)
        except sqlite3.IntegrityError as exc:
            _conflict_or_raise(exc)

    def update_student(self, student_db_id: int, payload: StudentUpdate) -> None:
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            return
        if not self.student_repo.get_by_id(student_db_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student record not found.",
            )
        try:
            with self.conn:
                self.student_repo.update(student_db_id, updates)
        except sqlite3.IntegrityError as exc:
            _conflict_or_raise(exc)

    def delete_student(self, student_db_id: int) -> None:
        if not self.student_repo.get_by_id(student_db_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student record not found.",
            )
        with self.conn:
            self.student_repo.delete(student_db_id)

    def reorder_students(self, lecture_id: int, ordered_ids: List[int]) -> None:
        if not self.lecture_repo.get_by_id(lecture_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found."
            )
        with self.conn:
            self.student_repo.reorder(lecture_id, ordered_ids)

    def process_student_checkin(self, lecture_id: int, student_id: str) -> str:
        student = self.student_repo.get_by_university_id(lecture_id, student_id)
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="University ID was not found in this lecture roster.",
            )

        lecture = self.lecture_repo.get_by_id(lecture_id)
        if not lecture:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found."
            )

        now = self._now()
        matching_day_found, is_window_open = attendance_window_state(
            lecture["schedules"], now
        )

        if not matching_day_found:
            days = ", ".join({s["day_of_week"] for s in lecture["schedules"]})
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This lecture does not run today. Active days: {days}.",
            )

        if not is_window_open:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Attendance window is currently closed.",
            )

        session_date = now.strftime("%Y-%m-%d")
        attended_at = now.strftime("%Y-%m-%d %H:%M:%S")

        with self.conn:
            self.attendance_repo.record_attendance(
                student["id"], session_date, attended_at
            )

        return attended_at

    def modify_attendance_manually(
        self, student_db_id: int, is_present: bool, target_date: Optional[str]
    ) -> None:
        if not self.student_repo.get_by_id(student_db_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student record not found.",
            )

        session_date = target_date or self._now().strftime("%Y-%m-%d")
        now_str = self._now().strftime("%Y-%m-%d %H:%M:%S")
        with self.conn:
            if is_present:
                self.attendance_repo.record_attendance(
                    student_db_id, session_date, now_str
                )
            else:
                self.attendance_repo.remove_attendance(student_db_id, session_date)
