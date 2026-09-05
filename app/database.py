import sqlite3
from typing import Generator

DB_NAME = "attendance.db"


def get_db_connection() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    conn = sqlite3.connect(DB_NAME)
    try:
        with conn:
            conn.execute("PRAGMA foreign_keys = ON;")

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS lectures (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    start_date TEXT
                );
                """
            )

            # Databases created before start_date existed need the column added.
            existing_columns = {
                row[1] for row in conn.execute("PRAGMA table_info(lectures);")
            }
            if "start_date" not in existing_columns:
                conn.execute("ALTER TABLE lectures ADD COLUMN start_date TEXT;")

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS lecture_schedules (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lecture_id INTEGER NOT NULL,
                    day_of_week TEXT NOT NULL,
                    lecture_start_time TEXT NOT NULL,
                    lecture_end_time TEXT NOT NULL,
                    attendance_start_time TEXT NOT NULL,
                    attendance_end_time TEXT NOT NULL,
                    FOREIGN KEY (lecture_id) REFERENCES lectures (id) ON DELETE CASCADE
                );
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS students (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lecture_id INTEGER NOT NULL,
                    student_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    FOREIGN KEY (lecture_id) REFERENCES lectures (id) ON DELETE CASCADE
                );
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS attendance_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    student_db_id INTEGER NOT NULL,
                    session_date TEXT NOT NULL,
                    attended_at TEXT NOT NULL,
                    FOREIGN KEY (student_db_id) REFERENCES students (id) ON DELETE CASCADE,
                    UNIQUE(student_db_id, session_date)
                );
                """
            )

            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_schedules_lecture ON lecture_schedules (lecture_id);"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_students_lecture ON students (lecture_id, sort_order);"
            )
            try:
                conn.execute(
                    "CREATE UNIQUE INDEX IF NOT EXISTS idx_students_unique_sid ON students (lecture_id, student_id);"
                )
            except sqlite3.IntegrityError:
                pass
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_attendance_lookup ON attendance_records (student_db_id, session_date);"
            )
    finally:
        conn.close()
