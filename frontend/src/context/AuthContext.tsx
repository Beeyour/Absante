import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getDoctorToken, setDoctorToken } from "../services/api";

interface AuthContextValue {
    ready: boolean;
    authenticated: boolean;
    login: (password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [ready, setReady] = useState(false);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const bootstrap = async () => {
            if (!getDoctorToken()) {
                if (!cancelled) {
                    setAuthenticated(false);
                    setReady(true);
                }
                return;
            }
            const ok = await api.doctorSession();
            if (!cancelled) {
                setAuthenticated(ok);
                setReady(true);
            }
        };
        bootstrap();
        const onLost = () => setAuthenticated(false);
        window.addEventListener("absante-auth-lost", onLost);
        return () => {
            cancelled = true;
            window.removeEventListener("absante-auth-lost", onLost);
        };
    }, []);

    const login = useCallback(async (password: string) => {
        await api.doctorLogin(password);
        setAuthenticated(true);
    }, []);

    const logout = useCallback(() => {
        setDoctorToken(null);
        setAuthenticated(false);
    }, []);

    const value = useMemo(
        () => ({ ready, authenticated, login, logout }),
        [ready, authenticated, login, logout]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("AuthProvider is required");
    return ctx;
}
