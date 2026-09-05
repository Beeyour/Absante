export type WeekDay =
    | "Sunday"
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday";

export interface Schedule {
    id?: number;
    day_of_week: WeekDay;
    lecture_start_time: string;
    lecture_end_time: string;
    attendance_start_time: string;
    attendance_end_time: string;
}

export interface Student {
    id: number;
    student_id: string;
    name: string;
    sort_order: number;
    is_present: boolean;
    attended_at: string | null;
}

export type SessionRuntimeStatus = "past" | "active" | "upcoming";

export interface LectureSession {
    date: string;
    day_of_week: WeekDay | string;
    session_index: number;
    lecture_start_time: string;
    lecture_end_time: string;
    attendance_start_time: string;
    attendance_end_time: string;
}

export interface WeekLectureSession extends LectureSession {
    status: SessionRuntimeStatus;
}

export interface TargetSession {
    date: string;
    session_index: number;
    day_of_week: number;
    is_past: boolean;
}

export interface Lecture {
    id: number;
    title: string;
    start_date?: string | null;
    schedules: Schedule[];
    current_week_sessions?: WeekLectureSession[];
}

export interface LectureSessionsResponse {
    sessions: LectureSession[];
    default_date: string | null;
    timezone: string;
}

export interface LectureDetail {
    lecture: Lecture;
    students: Student[];
    session_date?: string | null;
}

export interface StudentSelfStatus {
    lecture: Lecture;
    student: Student | null;
    found: boolean;
    target_session?: TargetSession | null;
}
