from datetime import date
from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class WeekDay(str, Enum):
    SUNDAY = "Sunday"
    MONDAY = "Monday"
    TUESDAY = "Tuesday"
    WEDNESDAY = "Wednesday"
    THURSDAY = "Thursday"
    FRIDAY = "Friday"
    SATURDAY = "Saturday"


class ScheduleBase(BaseModel):
    day_of_week: WeekDay
    lecture_start_time: str = Field(..., examples=["08:00"])
    lecture_end_time: str = Field(..., examples=["09:50"])
    attendance_start_time: str = Field(..., examples=["08:00"])
    attendance_end_time: str = Field(..., examples=["08:15"])


class ScheduleCreate(ScheduleBase):
    pass


class ScheduleOut(ScheduleBase):
    id: int


class StudentBase(BaseModel):
    student_id: str = Field(..., min_length=1, examples=["452033013"])
    name: str = Field(..., min_length=1, examples=["Mohammad Ahmad"])


class StudentCreate(StudentBase):
    pass


class BulkStudentCreate(BaseModel):
    students: List[StudentCreate]


class StudentUpdate(BaseModel):
    student_id: Optional[str] = Field(None, min_length=1)
    name: Optional[str] = Field(None, min_length=1)


class StudentAttendanceOut(StudentBase):
    id: int
    sort_order: int
    is_present: bool
    attended_at: Optional[str] = None


class LectureCreate(BaseModel):
    title: str = Field(..., min_length=1, examples=["Operating Systems - Section 1"])
    start_date: Optional[date] = Field(None, examples=["2026-09-06"])
    schedules: List[ScheduleCreate]


class LectureUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    start_date: Optional[date] = None
    schedules: Optional[List[ScheduleCreate]] = None


class LectureOut(BaseModel):
    id: int
    title: str
    start_date: Optional[date] = None
    schedules: List[ScheduleOut]


class LectureSessionOut(BaseModel):
    date: str
    day_of_week: str
    session_index: int
    lecture_start_time: str
    lecture_end_time: str
    attendance_start_time: str
    attendance_end_time: str


class WeekLectureSessionOut(LectureSessionOut):
    status: Literal["past", "active", "upcoming"]


class StudentLectureOut(LectureOut):
    current_week_sessions: List[WeekLectureSessionOut] = Field(default_factory=list)


class LectureDetailOut(BaseModel):
    lecture: LectureOut
    students: List[StudentAttendanceOut]
    session_date: Optional[str] = None


class StudentCheckInRequest(BaseModel):
    student_id: str = Field(..., min_length=1)


class StudentStatusRequest(BaseModel):
    student_id: str = Field(..., min_length=1)


class DoctorManualAttendanceRequest(BaseModel):
    is_present: bool
    session_date: Optional[str] = None


class ReorderRequest(BaseModel):
    ordered_student_ids: List[int]


class DoctorLoginRequest(BaseModel):
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TargetSessionOut(BaseModel):
    date: str
    session_index: int
    day_of_week: int
    is_past: bool


class StudentSelfStatusOut(BaseModel):
    lecture: StudentLectureOut
    student: Optional[StudentAttendanceOut] = None
    found: bool
    target_session: Optional[TargetSessionOut] = None


class LectureSessionsOut(BaseModel):
    sessions: List[LectureSessionOut]
    default_date: Optional[str] = None
    timezone: str
