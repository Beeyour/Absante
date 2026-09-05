export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const WEEKDAY_AR: Record<(typeof WEEKDAYS)[number], string> = {
    Sunday: "الأحد",
    Monday: "الاثنين",
    Tuesday: "الثلاثاء",
    Wednesday: "الأربعاء",
    Thursday: "الخميس",
    Friday: "الجمعة",
    Saturday: "السبت",
};

/** ISO weekday names: Monday = 0 … Sunday = 6. */
const ISO_WEEKDAYS: (typeof WEEKDAYS)[number][] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function weekdayAr(day: (typeof WEEKDAYS)[number] | string | number): string {
    if (typeof day === "number") {
        const name = ISO_WEEKDAYS[day];
        return name ? WEEKDAY_AR[name] : String(day);
    }
    return WEEKDAY_AR[day as (typeof WEEKDAYS)[number]] ?? day;
}

const KNOWN_ERRORS: Record<string, string> = {
    "Incorrect password.": "كلمة المرور غير صحيحة.",
    "Doctor authentication required.": "يلزم تسجيل الدخول للوحة المحاضر.",
    "Session expired.": "انتهت المحاضرة، سجّل الدخول مرة أخرى.",
    "Invalid session token.": "جلسة غير صالحة، سجّل الدخول مرة أخرى.",
    "Lecture not found.": "المحاضرة غير موجودة.",
    "Student record not found.": "سجل الطالب غير موجود.",
    "University ID was not found in this lecture roster.": "الرقم الجامعي غير موجود في كشف هذه المحاضرة.",
    "Attendance window is currently closed.": "نافذة التحضير مغلقة حالياً.",
    "A student with this university ID already exists in the lecture.": "هذا الرقم الجامعي مسجّل مسبقاً في المحاضرة.",
    "At least one weekly schedule must be configured.": "أضف موعداً أسبوعياً واحداً على الأقل.",
    "Provide at least one student.": "أدخل طالباً واحداً على الأقل.",
    "Could not save the record.": "تعذر حفظ السجل.",
};

export function translateError(message: string): string {
    if (KNOWN_ERRORS[message]) return KNOWN_ERRORS[message];
    if (message.startsWith("This lecture does not run today.")) {
        return "لا توجد محاضرة اليوم حسب الجدول المعتمد.";
    }
    return message;
}

export async function parseApiError(res: Response): Promise<string> {
    try {
        const body = await res.json();
        const detail = body?.detail;
        if (typeof detail === "string") return translateError(detail);
        if (Array.isArray(detail)) {
            return detail.map((item) => (typeof item?.msg === "string" ? item.msg : JSON.stringify(item))).join("، ");
        }
    } catch {
        /* ignore */
    }
    return "تعذر إكمال الطلب. تحقق من الاتصال بالخادم.";
}

const ARABIC_INDIC_START = 0x0660;
const EXTENDED_ARABIC_INDIC_START = 0x06f0;

/** Normalize Arabic/Persian digits to ASCII and drop everything that is not 0-9. */
export function sanitizeStudentId(raw: string): string {
    return raw
        .replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (char) => {
            const code = char.charCodeAt(0);
            const base = code >= EXTENDED_ARABIC_INDIC_START ? EXTENDED_ARABIC_INDIC_START : ARABIC_INDIC_START;
            return String(code - base);
        })
        .replace(/[^0-9]/g, "");
}

export function emptySchedule() {
    return {
        day_of_week: "Sunday" as const,
        lecture_start_time: "08:00",
        lecture_end_time: "09:50",
        attendance_start_time: "08:00",
        attendance_end_time: "08:15",
    };
}

export function todayIso(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60_000);
    return local.toISOString().slice(0, 10);
}
