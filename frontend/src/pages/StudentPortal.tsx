import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock3, GraduationCap, LogIn } from "lucide-react";
import { api } from "../services/api";
import { Lecture, SessionRuntimeStatus, StudentSelfStatus, WeekLectureSession } from "../types";
import { WEEKDAY_AR, sanitizeStudentId, weekdayAr } from "../lib/format";
import { Button, Card, Field, inputClass } from "../components/ui";
import { useToast } from "../context/ToastContext";

const ALREADY_PRESENT_MESSAGE = "لقد تم تحضيرك من قبل";

function lectureDays(lecture: Lecture): string[] {
    const seen = new Set<string>();
    for (const slot of lecture.schedules) {
        seen.add(WEEKDAY_AR[slot.day_of_week] ?? slot.day_of_week);
    }
    return [...seen];
}

function weekSessionCardClass(status: SessionRuntimeStatus): string {
    if (status === "active") {
        return "rounded-xl border-2 border-emerald-500 bg-emerald-50/80 p-3 shadow-sm";
    }
    if (status === "past") {
        return "rounded-xl border border-slate-200 bg-slate-100/80 p-3 text-slate-500";
    }
    return "rounded-xl border border-slate-200 bg-white p-3";
}

function WeekSessionCard({ session }: { session: WeekLectureSession }) {
    const dayLabel = weekdayAr(session.day_of_week);
    return (
        <div className={weekSessionCardClass(session.status)}>
            <div className="flex items-center justify-between gap-2">
                <span
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                        session.status === "active"
                            ? "bg-emerald-600 text-white"
                            : session.status === "past"
                              ? "bg-slate-200 text-slate-600"
                              : "bg-teal-50 text-teal-800"
                    }`}
                >
                    المحاضرة رقم ({session.session_index})
                </span>
                {session.status === "active" ? (
                    <span className="relative flex h-2.5 w-2.5" aria-hidden>
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </span>
                ) : null}
            </div>
            <p
                className={`mt-2 flex items-center gap-2 text-sm font-semibold ${
                    session.status === "past" ? "text-slate-500" : "text-slate-800"
                }`}
            >
                <CalendarDays size={16} className={session.status === "active" ? "text-emerald-700" : "text-teal-700"} />
                {dayLabel} — {session.date}
            </p>
            <p className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <Clock3 size={14} />
                المحاضرة: {session.lecture_start_time} — {session.lecture_end_time}
            </p>
            <p className={`mt-1 text-xs font-medium ${session.status === "past" ? "text-slate-500" : "text-emerald-700"}`}>
                التحضير: {session.attendance_start_time} — {session.attendance_end_time}
            </p>
        </div>
    );
}

export const StudentPortal: React.FC = () => {
    const { notify } = useToast();
    const [lectures, setLectures] = useState<Lecture[]>([]);
    const [lectureId, setLectureId] = useState<number | "">("");
    const [lecture, setLecture] = useState<Lecture | null>(null);
    const [studentId, setStudentId] = useState("");
    const [status, setStatus] = useState<StudentSelfStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        api.studentLectures()
            .then(setLectures)
            .catch((err: unknown) => {
                if (err instanceof Error) notify(err.message, "error");
            });
    }, [notify]);

    const present = Boolean(status?.student?.is_present);
    const presentOnOpenSession = present && status?.target_session?.is_past === false;

    const handleSelect = async (id: number) => {
        if (id === lectureId) return;
        setLectureId(id);
        setStatus(null);
        setLoading(true);
        try {
            setLecture(await api.studentLecture(id));
        } catch (err: unknown) {
            if (err instanceof Error) notify(err.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleStatus = async () => {
        if (typeof lectureId !== "number" || !studentId) {
            notify("أدخل رقمك الجامعي بعد اختيار المحاضرة.", "error");
            return;
        }
        setChecking(true);
        try {
            const result = await api.studentStatus(lectureId, studentId);
            setStatus(result);
            if (!result.found) notify("الرقم الجامعي غير موجود في كشف هذه المحاضرة.", "error");
        } catch (err: unknown) {
            if (err instanceof Error) notify(err.message, "error");
        } finally {
            setChecking(false);
        }
    };

    const handleCheckIn = async () => {
        if (typeof lectureId !== "number" || !studentId) {
            notify("أدخل رقمك الجامعي بعد اختيار المحاضرة.", "error");
            return;
        }
        if (presentOnOpenSession) {
            notify(ALREADY_PRESENT_MESSAGE, "info");
            return;
        }

        setChecking(true);
        try {
            const before = await api.studentStatus(lectureId, studentId);
            if (before.found && before.student?.is_present && before.target_session?.is_past === false) {
                setStatus(before);
                notify(ALREADY_PRESENT_MESSAGE, "info");
                return;
            }

            await api.studentCheckIn(lectureId, studentId);
            setStatus(await api.studentStatus(lectureId, studentId));
            notify("تم تسجيل حضورك بنجاح.", "success");
        } catch (err: unknown) {
            if (err instanceof Error) notify(err.message, "error");
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--student-bg)]">
            <header className="border-b border-teal-900/10 bg-white/80 backdrop-blur">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-700 text-white">
                            <GraduationCap size={22} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">Absante</p>
                            <p className="text-xs text-slate-500">بوابة الطالب للتحضير</p>
                        </div>
                    </div>
                    <Link
                        to="/doctor/login"
                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    >
                        <LogIn size={16} />
                        دخول المحاضر
                    </Link>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-5 py-10">
                <div className="mb-8 max-w-2xl">
                    <h1 className="text-3xl font-bold leading-tight text-slate-900">سجّل حضورك في المحاضرة</h1>
                    <p className="mt-2 text-slate-600">
                        اختر شعبتك، أدخل رقمك الجامعي، ثم أكّد التحضير خلال النافذة الزمنية المعتمدة.
                    </p>
                </div>

                <section className="mb-8">
                    <h2 className="mb-3 text-sm font-semibold text-slate-700">اختر المحاضرة</h2>
                    {lectures.length === 0 ? (
                        <Card className="p-6 text-sm text-slate-500">لا توجد محاضرات متاحة حالياً.</Card>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {lectures.map((item) => {
                                const active = item.id === lectureId;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => handleSelect(item.id)}
                                        aria-pressed={active}
                                        className={`rounded-2xl border p-4 text-right transition ${
                                            active
                                                ? "border-teal-700 bg-teal-50"
                                                : "border-slate-200 bg-white hover:border-teal-600/40 hover:bg-teal-50/40"
                                        }`}
                                    >
                                        <p className={`text-sm font-bold ${active ? "text-teal-900" : "text-slate-900"}`}>
                                            {item.title}
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {lectureDays(item).map((day) => (
                                                <span
                                                    key={day}
                                                    className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                                                >
                                                    {day}
                                                </span>
                                            ))}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </section>

                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <Card className="p-6">
                        <div className="space-y-5">
                            <Field label="الرقم الجامعي" hint="مثال : 452033013">
                                <input
                                    value={studentId}
                                    onChange={(e) => setStudentId(sanitizeStudentId(e.target.value))}
                                    className={inputClass}
                                    inputMode="numeric"
                                    autoComplete="off"
                                    dir="ltr"
                                />
                            </Field>

                            <p className="text-xs text-slate-500"> </p>

                            <div className="flex flex-wrap gap-3">
                                <Button type="button" variant="secondary" onClick={handleStatus} disabled={checking}>
                                    التحقق من حالتي
                                </Button>
                                <Button
                                    type="button"
                                    variant={presentOnOpenSession ? "success" : "primary"}
                                    onClick={handleCheckIn}
                                    disabled={checking}
                                >
                                    {presentOnOpenSession ? "تم التحضير" : "تسجيل الحضور"}
                                </Button>
                            </div>
                        </div>
                    </Card>

                    <div className="space-y-4">
                        {loading ? <Card className="p-6 text-sm text-slate-500">جارٍ تحميل مواعيد المحاضرة…</Card> : null}

                        {lecture ? (
                            <Card className="overflow-hidden">
                                <div className="border-b border-slate-100 bg-teal-50/70 px-5 py-4">
                                    <h2 className="font-bold text-teal-950">{lecture.title}</h2>
                                    <p className="mt-1 text-xs text-teal-800/80">محاضرات هذا الأسبوع</p>
                                </div>
                                <div className="space-y-3 p-5">
                                    {(lecture.current_week_sessions ?? []).length === 0 ? (
                                        <p className="text-sm leading-7 text-slate-500">لا توجد جلسات مجدولة في هذا الأسبوع.</p>
                                    ) : (
                                        lecture.current_week_sessions?.map((session) => (
                                            <WeekSessionCard key={`${session.date}-${session.session_index}`} session={session} />
                                        ))
                                    )}
                                </div>
                            </Card>
                        ) : (
                            <Card className="p-6 text-sm leading-7 text-slate-500">
                                بعد اختيار المحاضرة ستظهر جلسات هذا الأسبوع ووقت التحضير هنا.
                            </Card>
                        )}

                        {status?.found && status.student ? (
                            <Card className="p-5">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className={present ? "text-emerald-600" : "text-slate-400"} size={22} />
                                    <div>
                                        <p className="font-bold text-slate-900">{status.student.name}</p>
                                        <p className="text-xs text-slate-500" dir="ltr">
                                            {status.student.student_id}
                                        </p>
                                        <p className="mt-2 text-sm leading-7 text-slate-800">
                                            {status.target_session
                                                ? present
                                                    ? `تم تسجيل حضورك في المحاضرة رقم (${status.target_session.session_index}) يوم ${weekdayAr(status.target_session.day_of_week)} بتاريخ ${status.target_session.date}${
                                                          status.student.attended_at
                                                              ? ` الساعة ${status.student.attended_at.split(" ")[1]}`
                                                              : ""
                                                      }.`
                                                    : `لم يُسجَّل حضورك في المحاضرة رقم (${status.target_session.session_index}) يوم ${weekdayAr(status.target_session.day_of_week)} بتاريخ ${status.target_session.date}.`
                                                : present
                                                  ? `حاضر${status.student.attended_at ? ` الساعة ${status.student.attended_at.split(" ")[1]}` : ""}`
                                                  : "لم يُسجَّل حضورك لهذه المحاضرة بعد."}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        ) : null}
                    </div>
                </div>
            </main>
        </div>
    );
};
