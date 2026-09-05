import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

export const Button: React.FC<
    React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
> = ({ variant = "primary", className = "", children, ...props }) => {
    const styles: Record<ButtonVariant, string> = {
        primary: "bg-teal-700 text-white hover:bg-teal-800 disabled:bg-teal-700/50",
        secondary: "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50",
        ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
        danger: "bg-rose-600 text-white hover:bg-rose-700",
        success: "bg-emerald-600 text-white hover:bg-emerald-700",
    };
    return (
        <button
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

export const Field: React.FC<{
    label: string;
    hint?: React.ReactNode;
    children: React.ReactNode;
}> = ({ label, hint, children }) => (
    <label className="block min-w-0 space-y-1.5">
        <span className="block text-sm font-semibold text-slate-700">{label}</span>
        {children}
        {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
    </label>
);

export const inputClass =
    "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

/** Tighter padding so the native AM/PM segment of `input[type=time]` never clips. */
export const timeInputClass =
    "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20";

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = "",
}) => (
    <div className={`rounded-2xl border border-slate-200 bg-white ${className}`}>{children}</div>
);
