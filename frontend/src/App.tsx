import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { StudentPortal } from "./pages/StudentPortal";
import { DoctorLogin } from "./pages/DoctorLogin";
import { DoctorApp } from "./pages/DoctorApp";

export const App: React.FC = () => {
    return (
        <ToastProvider>
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<StudentPortal />} />
                        <Route path="/doctor/login" element={<DoctorLogin />} />
                        <Route path="/doctor" element={<DoctorApp />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </ToastProvider>
    );
};

export default App;
