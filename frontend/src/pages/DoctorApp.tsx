import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, LogOut, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../services/api";
import { Lecture, LectureDetail, LectureSession, Schedule, Student } from "../types";
import { emptySchedule, sanitizeStudentId, todayIso } from "../lib/format";
import { Button, Card, Field, inputClass } from "../components/ui";
import { ScheduleEditor } from "../components/ScheduleEditor";
import { SessionStepper } from "../components/SessionStepper";

type Tab = "roster" | "absent" | "import" | "schedule";

function parseBulk(text: string): { student_id: string; name: string }[] {
    return text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const parts = line.split(/[,|\t]/).map((part) => part.trim());
            if (parts.length < 2) {
                const spaced = line.split(/\s+/);
                return {
                    student_id: spaced[0] ?? "",
                    name: spaced.slice(1).join(" "),
                };
            }
            return { student_id: parts[0], name: parts.slice(1).join(" ") };
        })
        .filter((row) => row.student_id && row.name);
}

export const DoctorApp: React.FC = () => {
    const { ready, authenticated, logout } = useAuth();
    const { notify } = useToast();
    const navigate = useNavigate();

    const [lectures, setLectures] = useState<Lecture[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [detail, setDetail] = useState<LectureDetail | null>(null);
    const [sessions, setSessions] = useState<LectureSession[]>([]);
    const [sessionDate, setSessionDate] = useState("");
    const [sessionTimezone, setSessionTimezone] = useState("Asia/Riyadh");
    const [tab, setTab] = useState<Tab>("roster");
    const [creating, setCreating] = useState(false);

    const [title, setTitle] = useState("");
    const [startDate, setStartDate] = useState(todayIso());
    const [schedules, setSchedules] = useState<Schedule[]>([emptySchedule()]);
    const [newId, setNewId] = useState("");
    const [newName, setNewName] = useState("");
    const [bulkText, setBulkText] = useState("");
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);

    const presentCount = useMemo(() => detail?.students.filter((student) => student.is_present).length ?? 0, [detail]);
    const absentList = useMemo(
        () =>
            (detail?.students ?? [])
                .map((student, index) => ({ student, originalIndex: index + 1 }))
                .filter(({ student }) => !student.is_present),
        [detail],
    );

    const loadLectures = async (preferId?: number | null) => {
        const data = await api.doctorLectures();
        setLectures(data);
        const requested = preferId === undefined ? selectedId : preferId;
        const nextId = requested && data.some((lecture) => lecture.id === requested) ? requested : (data[0]?.id ?? null);
        setSelectedId(nextId);
        return nextId;
    };

    const loadDetail = async (lectureId: number, date?: string) => {
        const data = await api.doctorLectureDetail(lectureId, date ?? sessionDate);
        setDetail(data);
        setTitle(data.lecture.title);
        setSchedules(data.lecture.schedules.length ? data.lecture.schedules : [emptySchedule()]);
        if (data.session_date) setSessionDate(data.session_date);
    };

    const loadLectureWorkspace = async (lectureId: number) => {
        const timeline = await api.doctorLectureSessions(lectureId);
        setSessions(timeline.sessions);
        setSessionTimezone(timeline.timezone);
        const nextDate = timeline.default_date || timeline.sessions[timeline.sessions.length - 1]?.date || "";
        setSessionDate(nextDate);
        await loadDetail(lectureId, nextDate || undefined);
    };

    useEffect(() => {
        if (!authenticated) return;
        loadLectures()
            .then((id) => {
                if (id) return loadLectureWorkspace(id);
            })
            .catch((err: unknown) => {
                if (err instanceof Error) notify(err.message, "error");
            });
    }, [authenticated]);

    if (!ready) {
        return <div className="flex min-h-screen items-center justify-center text-slate-500">جارٍ التحميل…</div>;
    }
    if (!authenticated) {
        return <Navigate to="/doctor/login" replace />;
    }

    const handleSelectLecture = async (id: number) => {
        setSelectedId(id);
        setCreating(false);
        setTab("roster");
        try {
            await loadLectureWorkspace(id);
        } catch (err: unknown) {
            if (err instanceof Error) notify(err.message, "error");
        }
    };

    const handleDateChange = async (value: string) => {
        setSessionDate(value);
        if (selectedId) {
            try {
                await loadDetail(selectedId, value);
            } catch (err: unknown) {
                if (err instanceof Error) notify(err.message, "error");
            }
        }
    };

    const handleCreate = async () => {
        if (!title.trim()) return notify("أدخل اسم المحاضرة.", "error");
        if (!startDate) return notify("اختر تاريخ أول محاضرة في الفصل.", "error");
        try {
            const created = await api.createLecture(title.trim(), schedules, startDate);
            notify("أُنشئت المحاضرة.", "success");
            setCreating(false);
            const next = await loadLectures(created.lecture_id);
            if (next) await loadLectureWorkspace(next);
        } catch (err: unknown) {
            if (err instanceof Error) notify(err.message, "error");
        }
    };

    const handleUpdateLecture = async () => {
        if (!selectedId) return;
        try {
            await api.updateLecture(selectedId, { title: title.trim(), schedules });
            notify("حُفظت تعديلات المحاضرة.", "success");
            await loadLectures(selectedId);
            await loadLectureWorkspace(selectedId);
        } catch (err: unknown) {
            if (err instanceof Error) notify(err.message, "error");
        }
    };

    const handleDeleteLecture = async () => {
        if (!selectedId) return;
        if (!confirm("حذف المحاضرة وكل كشفها وسجلات الحضور؟")) return;
        try {
            await api.deleteLecture(selectedId);
            notify("حُذفت المحاضرة.", "success");
            setDetail(null);
            const next = await loadLectures(null);
            setSelectedId(next);
            if (next) await loadLectureWorkspace(next);
        } catch (err: unknown) {
            if (err instanceof Error) notify(err.message, "error");
        }
    };

    const handleAddStudent = async () => {
        if (!selectedId || !newId.trim() || !newName.trim()) return;
        try {
            await api.addStudent(selectedId, newId.trim(), newName.trim());
            setNewId("");
            setNewName("");
            await loadDetail(selectedId, sessionDate);
            notify("أُضيف الطالب.", "success");
        } catch (err: unknown) {
            if (err instanceof Error) notify(err.message, "error");
        }
    };

    const handleBulk = async () => {
        if (!selectedId) return;
        const rows = parseBulk(bulkText);
        if (!rows.length) return notify("الصق الأسطر بالصيغة: الرقم، الاسم", "error");
        try {
            const result = await api.bulkAddStudents(selectedId, rows);
            notify(`تم استيراد ${rows.length} طالباً.`, "success");
            void result;
            setBulkText("");
            await loadDetail(selectedId, sessionDate);
        } catch (err: unknown) {
            if (err instanceof Error) notify(err.message, "error");
        }
    };

    const handleMove = async (index: number, direction: -1 | 1) => {
        if (!selectedId || !detail) return;
        const target = index + direction;
        if (target < 0 || target >= detail.students.length) return;
        const updated = [...detail.students];
        const current = updated[index];
        updated[index] = updated[target];
        updated[target] = current;
        setDetail({ ...detail, students: updated });
        try {
            await api.reorderStudents(
                selectedId,
                updated.map((row) => row.id),
            );
        } catch {
            await loadDetail(selectedId, sessionDate);
        }
    };

    const handleAttendance = async (studentDbId: number, isPresent: boolean) => {
        if (!selectedId) return;
        try {
            await api.setAttendanceManual(studentDbId, isPresent, sessionDate);
            await loadDetail(selectedId, sessionDate);
        } catch (err: unknown) {
            if (err instanceof Error) notify(err.message, "error");
        }
    };

    const handleSaveStudent = async () => {
        if (!editingStudent || !selectedId) return;
        try {
            await api.updateStudent(editingStudent.id, {
                student_id: editingStudent.student_id,
                name: editingStudent.name,
            });
            setEditingStudent(null);
            await loadDetail(selectedId, sessionDate);
            notify("عُدّلت بيانات الطالب.", "success");
        } catch (err: unknown) {
            if (err instanceof Error) notify(err.message, "error");
        }
    };

    const handleDeleteStudent = async (id: number) => {
        if (!selectedId) return;
        if (!confirm("حذف الطالب من الكشف؟")) return;
        try {
            await api.deleteStudent(id);
            await loadDetail(selectedId, sessionDate);
        } catch (err: unknown) {
            if (err instanceof Error) notify(err.message, "error");
        }
    };

    const startCreate = () => {
        setCreating(true);
        setSelectedId(null);
        setDetail(null);
        setTitle("");
        setStartDate(todayIso());
        setSchedules([emptySchedule()]);
        setTab("schedule");
    };

    return (
        <div className="min-h-screen bg-slate-100">
            <aside className="z-20 flex w-full flex-col border-b border-slate-800 bg-slate-950 text-slate-100 lg:fixed lg:inset-y-0 lg:right-0 lg:w-72 lg:border-b-0 lg:border-l">
                <div className="border-b border-white/10 px-5 py-5">
                    <p className="text-xs text-slate-400">Absante</p>
                    <h1 className="mt-1 text-lg font-bold">لوحة المحاضر</h1>
                </div>
                <div className="px-4 py-3">
                    <Button type="button" className="w-full bg-teal-500 text-slate-950 hover:bg-teal-400" onClick={startCreate}>
                        <Plus size={16} />
                        محاضرة جديدة
                    </Button>
                </div>
                <nav className="flex max-h-48 flex-1 gap-2 overflow-x-auto px-3 pb-4 lg:max-h-none lg:flex-col lg:gap-1 lg:overflow-y-auto">
                    {lectures.map((lecture) => (
                        <button
                            key={lecture.id}
                            type="button"
                            onClick={() => handleSelectLecture(lecture.id)}
                            className={`block shrink-0 rounded-xl px-3 py-2.5 text-right text-sm transition lg:w-full ${
                                lecture.id === selectedId && !creating ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
                            }`}
                        >
                            {lecture.title}
                        </button>
                    ))}
                    {lectures.length === 0 ? <p className="px-3 py-6 text-sm text-slate-500">لا توجد محاضرات بعد.</p> : null}
                </nav>
                <div className="space-y-2 border-t border-white/10 p-4">
                    <Link to="/" className="block text-sm text-slate-400 hover:text-white">
                        بوابة الطالب
                    </Link>
                    <button
                        type="button"
                        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white"
                        onClick={() => {
                            logout();
                            navigate("/doctor/login");
                        }}
                    >
                        <LogOut size={16} />
                        خروج
                    </button>
                </div>
            </aside>

            <main className="min-h-screen px-6 py-8 lg:mr-72">
                {creating ? (
                    <Card className="mx-auto max-w-4xl p-6">
                        <h2 className="mb-5 text-xl font-bold text-slate-900">إنشاء محاضرة</h2>
                        <div className="space-y-5">
                            <div className="grid gap-5 md:grid-cols-2">
                                <Field label="اسم المادة / الشعبة">
                                    <input
                                        className={inputClass}
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="مثال: نظم التشغيل — شعبة 1"
                                    />
                                </Field>
                                <Field label="تاريخ أول محاضرة" hint="بداية الفصل. تُحسب جلسات الكشف انطلاقاً من هذا التاريخ.">
                                    <input
                                        type="date"
                                        className={inputClass}
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </Field>
                            </div>
                            <ScheduleEditor schedules={schedules} onChange={setSchedules} />
                            <div className="flex gap-3">
                                <Button type="button" onClick={handleCreate}>
                                    اعتماد المحاضرة
                                </Button>
                                <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                                    إلغاء
                                </Button>
                            </div>
                        </div>
                    </Card>
                ) : detail && selectedId ? (
                    <div className="mx-auto max-w-6xl space-y-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">{detail.lecture.title}</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    الحاضرون في هذه المحاضرة: {presentCount} من {detail.students.length}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-end gap-3">
                                <SessionStepper
                                    sessions={sessions}
                                    selectedDate={sessionDate}
                                    onChange={handleDateChange}
                                    timezoneLabel={sessionTimezone}
                                />
                                <Button type="button" variant="danger" onClick={handleDeleteLecture}>
                                    <Trash2 size={16} />
                                    حذف
                                </Button>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {(
                                [
                                    ["roster", "الكشف"],
                                    ["absent", "الغياب"],
                                    ["import", "استيراد"],
                                    ["schedule", "المواعيد"],
                                ] as const
                            ).map(([key, label]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setTab(key)}
                                    className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                                        tab === key ? "bg-slate-900 text-white" : "bg-white text-slate-600"
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {tab === "roster" ? (
                            <Card className="overflow-hidden">
                                <div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto]">
                                    <input
                                        className={inputClass}
                                        placeholder="الرقم الجامعي"
                                        inputMode="numeric"
                                        value={newId}
                                        onChange={(e) => setNewId(sanitizeStudentId(e.target.value))}
                                        dir="ltr"
                                    />
                                    <input
                                        className={inputClass}
                                        placeholder="اسم الطالب"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                    />
                                    <Button type="button" onClick={handleAddStudent}>
                                        <Users size={16} />
                                        إضافة
                                    </Button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right text-sm">
                                        <thead className="bg-white text-slate-500">
                                            <tr>
                                                <th className="p-3">الترتيب</th>
                                                <th className="p-3">الرقم</th>
                                                <th className="p-3">الاسم</th>
                                                <th className="p-3 text-center">الحضور</th>
                                                <th className="p-3 text-center">إجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detail.students.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="p-10 text-center text-slate-400">
                                                        أضف الطلاب يدوياً أو من تبويب الاستيراد.
                                                    </td>
                                                </tr>
                                            ) : (
                                                detail.students.map((student, index) => (
                                                    <tr key={student.id} className="border-t border-slate-100">
                                                        <td className="p-2">
                                                            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1">
                                                                <button
                                                                    type="button"
                                                                    disabled={index === 0}
                                                                    onClick={() => handleMove(index, -1)}
                                                                    className="text-slate-400 hover:text-teal-700 disabled:opacity-30"
                                                                >
                                                                    <ChevronUp size={16} />
                                                                </button>
                                                                <span className="w-5 text-center text-xs font-bold">{index + 1}</span>
                                                                <button
                                                                    type="button"
                                                                    disabled={index === detail.students.length - 1}
                                                                    onClick={() => handleMove(index, 1)}
                                                                    className="text-slate-400 hover:text-teal-700 disabled:opacity-30"
                                                                >
                                                                    <ChevronDown size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 font-mono text-slate-600" dir="ltr">
                                                            {student.student_id}
                                                        </td>
                                                        <td className="p-3 font-semibold text-slate-900">{student.name}</td>
                                                        <td className="p-3 text-center">
                                                            <div className="flex justify-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAttendance(student.id, true)}
                                                                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                                                        student.is_present
                                                                            ? "bg-emerald-100 text-emerald-800"
                                                                            : "bg-slate-100 text-slate-500"
                                                                    }`}
                                                                >
                                                                    حاضر
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAttendance(student.id, false)}
                                                                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                                                        !student.is_present
                                                                            ? "bg-rose-100 text-rose-800"
                                                                            : "bg-slate-100 text-slate-500"
                                                                    }`}
                                                                >
                                                                    غائب
                                                                </button>
                                                            </div>
                                                            {student.attended_at ? (
                                                                <p className="mt-1 text-[11px] text-slate-400">
                                                                    {student.attended_at.split(" ")[1]}
                                                                </p>
                                                            ) : null}
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex justify-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                                                                    onClick={() => setEditingStudent(student)}
                                                                >
                                                                    <Pencil size={16} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                                                    onClick={() => handleDeleteStudent(student.id)}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        ) : null}

                        {tab === "absent" ? (
                            <Card className="overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right text-sm">
                                        <thead className="bg-white text-slate-500">
                                            <tr>
                                                <th className="p-3">الترتيب</th>
                                                <th className="p-3">الرقم</th>
                                                <th className="p-3">الاسم</th>
                                                <th className="p-3 text-center">الحضور</th>
                                                <th className="p-3 text-center">إجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {absentList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="p-10 text-center text-slate-400">
                                                        لا يوجد طلاب غائبون في هذه الجلسة.
                                                    </td>
                                                </tr>
                                            ) : (
                                                absentList.map(({ student, originalIndex }) => (
                                                    <tr key={student.id} className="border-t border-slate-100">
                                                        <td className="p-2">
                                                            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1">
                                                                <span className="w-5 text-center text-xs font-bold">{originalIndex}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 font-mono text-slate-600" dir="ltr">
                                                            {student.student_id}
                                                        </td>
                                                        <td className="p-3 font-semibold text-slate-900">{student.name}</td>
                                                        <td className="p-3 text-center">
                                                            <div className="flex justify-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAttendance(student.id, true)}
                                                                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                                                        student.is_present
                                                                            ? "bg-emerald-100 text-emerald-800"
                                                                            : "bg-slate-100 text-slate-500"
                                                                    }`}
                                                                >
                                                                    حاضر
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAttendance(student.id, false)}
                                                                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                                                        !student.is_present
                                                                            ? "bg-rose-100 text-rose-800"
                                                                            : "bg-slate-100 text-slate-500"
                                                                    }`}
                                                                >
                                                                    غائب
                                                                </button>
                                                            </div>
                                                            {student.attended_at ? (
                                                                <p className="mt-1 text-[11px] text-slate-400">
                                                                    {student.attended_at.split(" ")[1]}
                                                                </p>
                                                            ) : null}
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex justify-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                                                                    onClick={() => setEditingStudent(student)}
                                                                >
                                                                    <Pencil size={16} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                                                    onClick={() => handleDeleteStudent(student.id)}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        ) : null}

                        {tab === "import" ? (
                            <Card className="p-6">
                                <h3 className="mb-2 font-bold text-slate-900">استيراد جماعي</h3>
                                <p className="mb-4 text-sm text-slate-500">سطر لكل طالب: الرقم الجامعي ثم فاصلة أو مسافة ثم الاسم.</p>
                                <textarea
                                    className={`${inputClass} min-h-48 font-mono`}
                                    value={bulkText}
                                    onChange={(e) => setBulkText(e.target.value)}
                                    placeholder={"452033013، عمر سرور  \n451014603، عبدالله الحجاب"}
                                />
                                <div className="mt-4">
                                    <Button type="button" onClick={handleBulk}>
                                        استيراد الكشف
                                    </Button>
                                </div>
                            </Card>
                        ) : null}

                        {tab === "schedule" ? (
                            <Card className="p-6 space-y-5">
                                <Field label="اسم المحاضرة">
                                    <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
                                </Field>
                                <ScheduleEditor schedules={schedules} onChange={setSchedules} />
                                <Button type="button" onClick={handleUpdateLecture}>
                                    حفظ التعديلات
                                </Button>
                            </Card>
                        ) : null}
                    </div>
                ) : (
                    <div className="flex min-h-[60vh] items-center justify-center text-slate-500">أنشئ محاضرة للبدء.</div>
                )}
            </main>

            {editingStudent ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="mb-4 text-lg font-bold">تعديل الطالب</h3>
                        <div className="space-y-4">
                            <Field label="الرقم الجامعي">
                                <input
                                    className={inputClass}
                                    inputMode="numeric"
                                    value={editingStudent.student_id}
                                    onChange={(e) =>
                                        setEditingStudent({
                                            ...editingStudent,
                                            student_id: sanitizeStudentId(e.target.value),
                                        })
                                    }
                                    dir="ltr"
                                />
                            </Field>
                            <Field label="الاسم">
                                <input
                                    className={inputClass}
                                    value={editingStudent.name}
                                    onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                                />
                            </Field>
                            <div className="flex gap-3">
                                <Button type="button" onClick={handleSaveStudent}>
                                    حفظ
                                </Button>
                                <Button type="button" variant="secondary" onClick={() => setEditingStudent(null)}>
                                    إلغاء
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            ) : null}
        </div>
    );
};
