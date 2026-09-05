import sqlite3
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status

from app.auth import require_doctor
from app.database import get_db_connection
from app.schemas import (
    BulkStudentCreate,
    DoctorManualAttendanceRequest,
    LectureCreate,
    LectureDetailOut,
    LectureOut,
    LectureSessionsOut,
    LectureUpdate,
    ReorderRequest,
    StudentCreate,
    StudentUpdate,
)
from app.services import UniversityAttendanceService

router = APIRouter(
    prefix="/api/doctor",
    tags=["Doctor Interface"],
    dependencies=[Depends(require_doctor)],
)


@router.get("/lectures", response_model=List[LectureOut])
def list_doctor_lectures(
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> List[LectureOut]:
    service = UniversityAttendanceService(conn)
    return service.list_all_lectures()


@router.post("/lectures", status_code=status.HTTP_201_CREATED)
def create_lecture(
    payload: LectureCreate,
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> dict:
    service = UniversityAttendanceService(conn)
    lecture_id = service.create_lecture(payload)
    return {"message": "Lecture created successfully", "lecture_id": lecture_id}


@router.get("/lectures/{lecture_id}/sessions", response_model=LectureSessionsOut)
def get_doctor_lecture_sessions(
    lecture_id: int, conn: sqlite3.Connection = Depends(get_db_connection)
) -> LectureSessionsOut:
    service = UniversityAttendanceService(conn)
    return service.get_lecture_sessions(lecture_id)


@router.get("/lectures/{lecture_id}", response_model=LectureDetailOut)
def get_doctor_lecture_details(
    lecture_id: int,
    date: Optional[str] = Query(None, description="Format: YYYY-MM-DD"),
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> LectureDetailOut:
    service = UniversityAttendanceService(conn)
    return service.get_lecture_roster(lecture_id, target_date=date)


@router.put("/lectures/{lecture_id}")
def update_lecture(
    lecture_id: int,
    payload: LectureUpdate,
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> dict:
    service = UniversityAttendanceService(conn)
    service.update_lecture(lecture_id, payload)
    return {"message": "Lecture updated successfully"}


@router.delete("/lectures/{lecture_id}")
def delete_lecture(
    lecture_id: int, conn: sqlite3.Connection = Depends(get_db_connection)
) -> dict:
    service = UniversityAttendanceService(conn)
    service.delete_lecture(lecture_id)
    return {"message": "Lecture deleted successfully"}


@router.post("/lectures/{lecture_id}/students", status_code=status.HTTP_201_CREATED)
def add_student(
    lecture_id: int,
    payload: StudentCreate,
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> dict:
    service = UniversityAttendanceService(conn)
    student_db_id = service.add_student_to_lecture(lecture_id, payload)
    return {"message": "Student added successfully", "student_id": student_db_id}


@router.post(
    "/lectures/{lecture_id}/students/bulk", status_code=status.HTTP_201_CREATED
)
def bulk_add_students(
    lecture_id: int,
    payload: BulkStudentCreate,
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> dict:
    service = UniversityAttendanceService(conn)
    service.bulk_add_students(lecture_id, payload.students)
    return {"message": f"Successfully imported {len(payload.students)} students"}


@router.put("/students/{student_db_id}")
def update_student_info(
    student_db_id: int,
    payload: StudentUpdate,
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> dict:
    service = UniversityAttendanceService(conn)
    service.update_student(student_db_id, payload)
    return {"message": "Student updated successfully"}


@router.delete("/students/{student_db_id}")
def delete_student(
    student_db_id: int, conn: sqlite3.Connection = Depends(get_db_connection)
) -> dict:
    service = UniversityAttendanceService(conn)
    service.delete_student(student_db_id)
    return {"message": "Student deleted successfully"}


@router.put("/lectures/{lecture_id}/students/reorder")
def reorder_students(
    lecture_id: int,
    payload: ReorderRequest,
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> dict:
    service = UniversityAttendanceService(conn)
    service.reorder_students(lecture_id, payload.ordered_student_ids)
    return {"message": "Roster reordered successfully"}


@router.post("/students/{student_db_id}/attendance")
def override_student_attendance(
    student_db_id: int,
    payload: DoctorManualAttendanceRequest,
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> dict:
    service = UniversityAttendanceService(conn)
    service.modify_attendance_manually(
        student_db_id, payload.is_present, payload.session_date
    )
    return {"message": "Attendance status overridden successfully"}
