import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LectureSession, WeekDay } from "../types";
import { WEEKDAY_AR } from "../lib/format";

interface SessionStepperProps {
    sessions: LectureSession[];
    selectedDate: string;
    onChange: (date: string) => void;
    timezoneLabel?: string;
}

function formatSessionDate(isoDate: string): string {
    const parsed = new Date(`${isoDate}T12:00:00`);
    return new Intl.DateTimeFormat("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
    }).format(parsed);
}

export const SessionStepper: React.FC<SessionStepperProps> = ({ sessions, selectedDate, onChange, timezoneLabel = "Asia/Riyadh" }) => {
    const index = sessions.findIndex((session) => session.date === selectedDate);
    const current = index >= 0 ? sessions[index] : sessions[0];
    const atStart = index <= 0;
    const atEnd = index < 0 || index >= sessions.length - 1;
    const dayName = current && current.day_of_week in WEEKDAY_AR ? WEEKDAY_AR[current.day_of_week as WeekDay] : current?.day_of_week;

    const go = (offset: number) => {
        const nextIndex = index + offset;
        if (nextIndex < 0 || nextIndex >= sessions.length) return;
        onChange(sessions[nextIndex].date);
    };

    if (!current) {
        return (
            <div className="min-w-[16rem]">
                <p className="mb-1.5 text-sm font-semibold text-slate-700">تاريخ المحاضرة</p>
                <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-500">
                    لا توجد جلسات مجدولة بعد.
                </div>
            </div>
        );
    }

    return (
        <div className="min-w-[18rem]">
            <p className="mb-1.5 text-sm font-semibold text-slate-700">تاريخ المحاضرة</p>
            <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white">
                <button
                    type="button"
                    onClick={() => go(-1)}
                    disabled={atStart}
                    aria-label="المحاضرة السابقة"
                    className="flex w-11 items-center justify-center text-slate-500 transition hover:bg-slate-50 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                >
                    <ChevronRight size={18} />
                </button>
                <div className="flex min-w-0 flex-1 flex-col items-center justify-center border-x border-slate-200 px-3 py-2 text-center">
                    <p className="text-sm font-bold text-slate-900">
                        {dayName} — {formatSessionDate(current.date)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                        المحاضرة {current.session_index} · {current.lecture_start_time}–{current.lecture_end_time}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => go(1)}
                    disabled={atEnd}
                    aria-label="المحاضرة التالية"
                    className="flex w-11 items-center justify-center text-slate-500 transition hover:bg-slate-50 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                >
                    <ChevronLeft size={18} />
                </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">التوقيت: {timezoneLabel}</p>
        </div>
    );
};
