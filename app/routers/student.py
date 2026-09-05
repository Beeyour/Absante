import sqlite3
from typing import List

from fastapi import APIRouter, Depends, status

from app.database import get_db_connection
from app.schemas import (
    LectureOut,
    StudentLectureOut,
    StudentCheckInRequest,
    StudentSelfStatusOut,
    StudentStatusRequest,
)
from app.services import UniversityAttendanceService

router = APIRouter(prefix="/api/student", tags=["Student Interface"])


@router.get("/lectures", response_model=List[LectureOut])
def get_all_lectures(
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> List[LectureOut]:
    service = UniversityAttendanceService(conn)
    return service.list_all_lectures()


@router.get("/lectures/{lecture_id}", response_model=StudentLectureOut)
def get_lecture(
    lecture_id: int, conn: sqlite3.Connection = Depends(get_db_connection)
) -> StudentLectureOut:
    service = UniversityAttendanceService(conn)
    return service.get_public_lecture(lecture_id)


@router.post("/lectures/{lecture_id}/status", response_model=StudentSelfStatusOut)
def get_own_status(
    lecture_id: int,
    payload: StudentStatusRequest,
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> StudentSelfStatusOut:
    service = UniversityAttendanceService(conn)
    return service.get_student_self_status(lecture_id, payload.student_id)


@router.post("/{lecture_id}/attend", status_code=status.HTTP_200_OK)
def self_checkin(
    lecture_id: int,
    payload: StudentCheckInRequest,
    conn: sqlite3.Connection = Depends(get_db_connection),
) -> dict:
    service = UniversityAttendanceService(conn)
    attended_at = service.process_student_checkin(lecture_id, payload.student_id)
    return {
        "message": "Attendance confirmed successfully",
        "attended_at": attended_at,
    }
