import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
    id: number;
    kind: ToastKind;
    message: string;
}

interface ToastContextValue {
    notify: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<ToastItem[]>([]);

    const notify = useCallback((message: string, kind: ToastKind = "info") => {
        const id = Date.now() + Math.random();
        setItems((current) => [...current, { id, kind, message }]);
        window.setTimeout(() => {
            setItems((current) => current.filter((item) => item.id !== id));
        }, 4200);
    }, []);

    const value = useMemo(() => ({ notify }), [notify]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="fixed bottom-5 left-5 z-[80] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-none ${
                            item.kind === "success"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                : item.kind === "error"
                                  ? "border-rose-200 bg-rose-50 text-rose-900"
                                  : "border-slate-200 bg-white text-slate-800"
                        }`}
                    >
                        {item.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("ToastProvider is required");
    return ctx;
}
