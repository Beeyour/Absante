import sqlite3
from typing import Any, Dict, List, Optional

from app.timeutil import parse_iso_date


class LectureRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn

    @staticmethod
    def _normalize_lecture_row(row: Dict[str, Any]) -> Dict[str, Any]:
        # Legacy rows may hold an unparseable start_date; degrade instead of failing.
        parsed = parse_iso_date(row.get("start_date"))
        row["start_date"] = parsed.isoformat() if parsed else None
        return row

    def list_all(self) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        lectures = cursor.execute(
            "SELECT * FROM lectures ORDER BY id DESC;"
        ).fetchall()
        results = []
        for lecture in lectures:
            lec_dict = self._normalize_lecture_row(dict(lecture))
            schedules = cursor.execute(
                "SELECT * FROM lecture_schedules WHERE lecture_id = ? ORDER BY id ASC;",
                (lec_dict["id"],),
            ).fetchall()
            lec_dict["schedules"] = [dict(s) for s in schedules]
            results.append(lec_dict)
        return results

    def get_by_id(self, lecture_id: int) -> Optional[Dict[str, Any]]:
        cursor = self.conn.cursor()
        lecture = cursor.execute(
            "SELECT * FROM lectures WHERE id = ?;", (lecture_id,)
        ).fetchone()
        if not lecture:
            return None

        lec_dict = self._normalize_lecture_row(dict(lecture))
        schedules = cursor.execute(
            "SELECT * FROM lecture_schedules WHERE lecture_id = ? ORDER BY id ASC;",
            (lecture_id,),
        ).fetchall()
        lec_dict["schedules"] = [dict(s) for s in schedules]
        return lec_dict

    def create(
        self,
        title: str,
        schedules: List[Dict[str, Any]],
        start_date: Optional[str] = None,
    ) -> int:
        cursor = self.conn.cursor()
        cursor.execute(
            "INSERT INTO lectures (title, start_date) VALUES (?, ?);",
            (title, start_date),
        )
        lecture_id = int(cursor.lastrowid)

        schedule_payloads = [
            (
                lecture_id,
                s["day_of_week"],
                s["lecture_start_time"],
                s["lecture_end_time"],
                s["attendance_start_time"],
                s["attendance_end_time"],
            )
            for s in schedules
        ]
        cursor.executemany(
            """
            INSERT INTO lecture_schedules (lecture_id, day_of_week, lecture_start_time, lecture_end_time, attendance_start_time, attendance_end_time)
            VALUES (?, ?, ?, ?, ?, ?);
            """,
            schedule_payloads,
        )
        return lecture_id

    def update(
        self,
        lecture_id: int,
        title: Optional[str],
        schedules: Optional[List[Dict[str, Any]]],
        start_date: Optional[str] = None,
    ) -> None:
        cursor = self.conn.cursor()
        if title is not None:
            cursor.execute(
                "UPDATE lectures SET title = ? WHERE id = ?;",
                (title, lecture_id),
            )

        if start_date is not None:
            cursor.execute(
                "UPDATE lectures SET start_date = ? WHERE id = ?;",
                (start_date, lecture_id),
            )

        if schedules is not None:
            cursor.execute(
                "DELETE FROM lecture_schedules WHERE lecture_id = ?;",
                (lecture_id,),
            )
            schedule_payloads = [
                (
                    lecture_id,
                    s["day_of_week"],
                    s["lecture_start_time"],
                    s["lecture_end_time"],
                    s["attendance_start_time"],
                    s["attendance_end_time"],
                )
                for s in schedules
            ]
            cursor.executemany(
                """
                INSERT INTO lecture_schedules (lecture_id, day_of_week, lecture_start_time, lecture_end_time, attendance_start_time, attendance_end_time)
                VALUES (?, ?, ?, ?, ?, ?);
                """,
                schedule_payloads,
            )

    def delete(self, lecture_id: int) -> None:
        self.conn.execute("DELETE FROM lectures WHERE id = ?;", (lecture_id,))


class StudentRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn

    def get_by_id(self, student_db_id: int) -> Optional[Dict[str, Any]]:
        cursor = self.conn.cursor()
        row = cursor.execute(
            "SELECT * FROM students WHERE id = ?;", (student_db_id,)
        ).fetchone()
        return dict(row) if row else None

    def get_by_university_id(
        self, lecture_id: int, student_id: str
    ) -> Optional[Dict[str, Any]]:
        cursor = self.conn.cursor()
        row = cursor.execute(
            "SELECT * FROM students WHERE lecture_id = ? AND student_id = ?;",
            (lecture_id, student_id.strip()),
        ).fetchone()
        return dict(row) if row else None

    def get_max_sort_order(self, lecture_id: int) -> int:
        cursor = self.conn.cursor()
        row = cursor.execute(
            "SELECT COALESCE(MAX(sort_order), -1) as max_val FROM students WHERE lecture_id = ?;",
            (lecture_id,),
        ).fetchone()
        return int(row["max_val"])

    def create(
        self, lecture_id: int, student_id: str, name: str, sort_order: int
    ) -> int:
        cursor = self.conn.cursor()
        cursor.execute(
            """
            INSERT INTO students (lecture_id, student_id, name, sort_order)
            VALUES (?, ?, ?, ?);
            """,
            (lecture_id, student_id.strip(), name.strip(), sort_order),
        )
        return int(cursor.lastrowid)

    def bulk_create(
        self, lecture_id: int, students: List[Dict[str, Any]], start_order: int
    ) -> None:
        payload = [
            (lecture_id, s["student_id"].strip(), s["name"].strip(), start_order + idx)
            for idx, s in enumerate(students)
        ]
        self.conn.executemany(
            """
            INSERT INTO students (lecture_id, student_id, name, sort_order)
            VALUES (?, ?, ?, ?);
            """,
            payload,
        )

    def update(self, student_db_id: int, updates: Dict[str, Any]) -> None:
        allowed = {"student_id", "name"}
        filtered = {key: value for key, value in updates.items() if key in allowed}
        if "student_id" in filtered and isinstance(filtered["student_id"], str):
            filtered["student_id"] = filtered["student_id"].strip()
        if "name" in filtered and isinstance(filtered["name"], str):
            filtered["name"] = filtered["name"].strip()
        if not filtered:
            return
        fields = [f"{key} = ?" for key in filtered.keys()]
        values = list(filtered.values())
        values.append(student_db_id)
        query = f"UPDATE students SET {', '.join(fields)} WHERE id = ?;"
        self.conn.execute(query, values)

    def delete(self, student_db_id: int) -> None:
        self.conn.execute("DELETE FROM students WHERE id = ?;", (student_db_id,))

    def reorder(self, lecture_id: int, ordered_ids: List[int]) -> None:
        for new_index, student_id in enumerate(ordered_ids):
            self.conn.execute(
                "UPDATE students SET sort_order = ? WHERE id = ? AND lecture_id = ?;",
                (new_index, student_id, lecture_id),
            )

    def get_roster_with_attendance(
        self, lecture_id: int, session_date: str
    ) -> List[Dict[str, Any]]:
        cursor = self.conn.cursor()
        query = """
            SELECT
                s.id,
                s.student_id,
                s.name,
                s.sort_order,
                CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END AS is_present,
                a.attended_at
            FROM students s
            LEFT JOIN attendance_records a
                ON s.id = a.student_db_id AND a.session_date = ?
            WHERE s.lecture_id = ?
            ORDER BY s.sort_order ASC;
        """
        rows = cursor.execute(query, (session_date, lecture_id)).fetchall()
        return [self._normalize_student_row(dict(row)) for row in rows]

    def get_status_with_attendance(
        self, lecture_id: int, student_id: str, session_date: str
    ) -> Optional[Dict[str, Any]]:
        cursor = self.conn.cursor()
        query = """
            SELECT
                s.id,
                s.student_id,
                s.name,
                s.sort_order,
                CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END AS is_present,
                a.attended_at
            FROM students s
            LEFT JOIN attendance_records a
                ON s.id = a.student_db_id AND a.session_date = ?
            WHERE s.lecture_id = ? AND s.student_id = ?
            LIMIT 1;
        """
        row = cursor.execute(
            query, (session_date, lecture_id, student_id.strip())
        ).fetchone()
        return self._normalize_student_row(dict(row)) if row else None

    @staticmethod
    def _normalize_student_row(row: Dict[str, Any]) -> Dict[str, Any]:
        row["is_present"] = bool(row.get("is_present"))
        return row


class AttendanceRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self.conn = conn

    def record_attendance(
        self, student_db_id: int, session_date: str, attended_at: str
    ) -> None:
        self.conn.execute(
            """
            INSERT OR IGNORE INTO attendance_records (student_db_id, session_date, attended_at)
            VALUES (?, ?, ?);
            """,
            (student_db_id, session_date, attended_at),
        )

    def remove_attendance(self, student_db_id: int, session_date: str) -> None:
        self.conn.execute(
            """
            DELETE FROM attendance_records
            WHERE student_db_id = ? AND session_date = ?;
            """,
            (student_db_id, session_date),
        )

    def list_session_dates_for_lecture(self, lecture_id: int) -> List[str]:
        cursor = self.conn.cursor()
        rows = cursor.execute(
            """
            SELECT DISTINCT a.session_date
            FROM attendance_records a
            INNER JOIN students s ON s.id = a.student_db_id
            WHERE s.lecture_id = ?
            ORDER BY a.session_date ASC;
            """,
            (lecture_id,),
        ).fetchall()
        return [str(row["session_date"]) for row in rows]
