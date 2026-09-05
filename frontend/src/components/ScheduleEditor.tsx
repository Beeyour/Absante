import React from "react";
import { Schedule, WeekDay } from "../types";
import { WEEKDAY_AR, WEEKDAYS, emptySchedule } from "../lib/format";
import { Button, Field, inputClass, timeInputClass } from "./ui";
import { Plus, Trash2 } from "lucide-react";

interface ScheduleEditorProps {
    schedules: Schedule[];
    onChange: (schedules: Schedule[]) => void;
}

const TIME_FIELDS: { field: keyof Schedule; label: string }[] = [
    { field: "lecture_start_time", label: "بداية المحاضرة" },
    { field: "lecture_end_time", label: "نهاية المحاضرة" },
    { field: "attendance_start_time", label: "بداية التحضير" },
    { field: "attendance_end_time", label: "نهاية التحضير" },
];

export const ScheduleEditor: React.FC<ScheduleEditorProps> = ({ schedules, onChange }) => {
    const update = (index: number, field: keyof Schedule, value: string) => {
        const next = schedules.map((slot, slotIndex) =>
            slotIndex === index ? { ...slot, [field]: value } : slot
        );
        onChange(next);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">المواعيد الأسبوعية</p>
                <Button
                    type="button"
                    variant="ghost"
                    className="!py-1.5 text-teal-700"
                    onClick={() => onChange([...schedules, emptySchedule()])}
                >
                    <Plus size={16} />
                    موعد
                </Button>
            </div>
            {schedules.map((slot, index) => (
                <div
                    key={index}
                    className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(7rem,0.9fr)_repeat(4,minmax(8.5rem,1fr))_auto] xl:items-end"
                >
                    <Field label="اليوم">
                        <select
                            className={inputClass}
                            value={slot.day_of_week}
                            onChange={(e) => update(index, "day_of_week", e.target.value as WeekDay)}
                        >
                            {WEEKDAYS.map((day) => (
                                <option key={day} value={day}>
                                    {WEEKDAY_AR[day]}
                                </option>
                            ))}
                        </select>
                    </Field>

                    {TIME_FIELDS.map(({ field, label }) => (
                        <Field key={field} label={label}>
                            <input
                                type="time"
                                className={timeInputClass}
                                value={String(slot[field] ?? "")}
                                onChange={(e) => update(index, field, e.target.value)}
                            />
                        </Field>
                    ))}

                    <div className="flex justify-end sm:col-span-2 lg:col-span-3 xl:col-span-1 xl:justify-center xl:pb-1">
                        {schedules.length > 1 ? (
                            <button
                                type="button"
                                aria-label="حذف الموعد"
                                className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50"
                                onClick={() => onChange(schedules.filter((_, i) => i !== index))}
                            >
                                <Trash2 size={18} />
                            </button>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    );
};
