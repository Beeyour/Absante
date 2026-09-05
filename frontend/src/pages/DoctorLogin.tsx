import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Button, Card, Field, inputClass } from "../components/ui";

export const DoctorLogin: React.FC = () => {
    const { authenticated, ready, login } = useAuth();
    const { notify } = useToast();
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);

    if (ready && authenticated) {
        return <Navigate to="/doctor" replace />;
    }

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        try {
            await login(password);
            navigate("/doctor", { replace: true });
        } catch (err: unknown) {
            if (err instanceof Error) notify(err.message, "error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500 text-slate-950">
                        <ShieldCheck size={28} />
                    </div>
                    <h1 className="text-2xl font-bold text-white">لوحة المحاضر</h1>
                    <p className="mt-2 text-sm text-slate-400">مسار مستقل وخاص بالبروفسيور احمد بدر الدين الخضر .</p>
                </div>
                <Card className="p-6">
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <Field label="كلمة المرور">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={inputClass}
                                autoComplete="current-password"
                                required
                            />
                        </Field>
                        <Button type="submit" className="w-full" disabled={submitting}>
                            {submitting ? "جارٍ التحقق…" : "دخول"}
                        </Button>
                    </form>
                </Card>
                <p className="mt-6 text-center text-sm">
                    <Link to="/" className="text-slate-400 hover:text-white">
                        العودة إلى بوابة الطالب
                    </Link>
                </p>
            </div>
        </div>
    );
};
