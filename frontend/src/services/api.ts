import { Lecture, LectureDetail, LectureSessionsResponse, Schedule, StudentSelfStatus } from "../types";
import { parseApiError } from "../lib/format";

const TOKEN_KEY = "absante_doctor_token";

export function getApiBase(): string {
    const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
    if (!raw) return "";
    return raw.replace(/\/+$/, "");
}

export function getDoctorToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setDoctorToken(token: string | null): void {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    if (auth) {
        const token = getDoctorToken();
        if (token) headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(`${getApiBase()}${path}`, { ...init, headers });
    if (res.status === 401 && auth) {
        setDoctorToken(null);
        window.dispatchEvent(new Event("absante-auth-lost"));
    }
    if (!res.ok) {
        throw new Error(await parseApiError(res));
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
}

export const api = {
    async studentLectures(): Promise<Lecture[]> {
        return request("/api/student/lectures");
    },

    async studentLecture(lectureId: number): Promise<Lecture> {
        return request(`/api/student/lectures/${lectureId}`);
    },

    async studentStatus(lectureId: number, studentId: string): Promise<StudentSelfStatus> {
        return request(`/api/student/lectures/${lectureId}/status`, {
            method: "POST",
            body: JSON.stringify({ student_id: studentId }),
        });
    },

    async studentCheckIn(
        lectureId: number,
        studentId: string
    ): Promise<{ message: string; attended_at: string }> {
        return request(`/api/student/${lectureId}/attend`, {
            method: "POST",
            body: JSON.stringify({ student_id: studentId }),
        });
    },

    async doctorLogin(password: string): Promise<void> {
        const data = await request<{ access_token: string }>("/api/auth/doctor/login", {
            method: "POST",
            body: JSON.stringify({ password }),
        });
        setDoctorToken(data.access_token);
    },

    async doctorSession(): Promise<boolean> {
        try {
            await request("/api/auth/doctor/session", {}, true);
            return true;
        } catch {
            return false;
        }
    },

    async doctorLectures(): Promise<Lecture[]> {
        return request("/api/doctor/lectures", {}, true);
    },

    async doctorLectureSessions(lectureId: number): Promise<LectureSessionsResponse> {
        return request(`/api/doctor/lectures/${lectureId}/sessions`, {}, true);
    },

    async doctorLectureDetail(lectureId: number, date?: string): Promise<LectureDetail> {
        const query = date ? `?date=${encodeURIComponent(date)}` : "";
        return request(`/api/doctor/lectures/${lectureId}${query}`, {}, true);
    },

    async createLecture(
        title: string,
        schedules: Schedule[],
        startDate?: string
    ): Promise<{ lecture_id: number }> {
        return request(
            "/api/doctor/lectures",
            {
                method: "POST",
                body: JSON.stringify({
                    title,
                    schedules,
                    start_date: startDate || null,
                }),
            },
            true
        );
    },

    async updateLecture(
        lectureId: number,
        payload: { title?: string; schedules?: Schedule[]; start_date?: string }
    ): Promise<void> {
        await request(
            `/api/doctor/lectures/${lectureId}`,
            { method: "PUT", body: JSON.stringify(payload) },
            true
        );
    },

    async deleteLecture(lectureId: number): Promise<void> {
        await request(`/api/doctor/lectures/${lectureId}`, { method: "DELETE" }, true);
    },

    async addStudent(lectureId: number, studentId: string, name: string): Promise<void> {
        await request(
            `/api/doctor/lectures/${lectureId}/students`,
            { method: "POST", body: JSON.stringify({ student_id: studentId, name }) },
            true
        );
    },

    async bulkAddStudents(
        lectureId: number,
        students: { student_id: string; name: string }[]
    ): Promise<{ message: string }> {
        return request(
            `/api/doctor/lectures/${lectureId}/students/bulk`,
            { method: "POST", body: JSON.stringify({ students }) },
            true
        );
    },

    async updateStudent(
        studentDbId: number,
        payload: { student_id?: string; name?: string }
    ): Promise<void> {
        await request(
            `/api/doctor/students/${studentDbId}`,
            { method: "PUT", body: JSON.stringify(payload) },
            true
        );
    },

    async deleteStudent(studentDbId: number): Promise<void> {
        await request(`/api/doctor/students/${studentDbId}`, { method: "DELETE" }, true);
    },

    async reorderStudents(lectureId: number, orderedIds: number[]): Promise<void> {
        await request(
            `/api/doctor/lectures/${lectureId}/students/reorder`,
            {
                method: "PUT",
                body: JSON.stringify({ ordered_student_ids: orderedIds }),
            },
            true
        );
    },

    async setAttendanceManual(
        studentDbId: number,
        isPresent: boolean,
        sessionDate?: string
    ): Promise<void> {
        await request(
            `/api/doctor/students/${studentDbId}/attendance`,
            {
                method: "POST",
                body: JSON.stringify({
                    is_present: isPresent,
                    session_date: sessionDate || null,
                }),
            },
            true
        );
    },
};
