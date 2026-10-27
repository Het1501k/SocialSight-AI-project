
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ReelAnalyzer from "./pages/ReelAnalyzer";
import AnalysisHistory from "./pages/AnalysisHistory";
import Wishlist from "./pages/Wishlist";
import Profile from "./pages/Profile";

import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";

import "./style.css";

function PrivatePage({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* Authentication */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected workspace pages */}
        <Route
          path="/dashboard"
          element={
            <PrivatePage>
              <Dashboard />
            </PrivatePage>
          }
        />

        <Route
          path="/analyze"
          element={
            <PrivatePage>
              <ReelAnalyzer />
            </PrivatePage>
          }
        />

        <Route
          path="/history"
          element={
            <PrivatePage>
              <AnalysisHistory />
            </PrivatePage>
          }
        />

        <Route
          path="/wishlist"
          element={
            <PrivatePage>
              <Wishlist />
            </PrivatePage>
          }
        />

        {/* User profile */}
        <Route
          path="/profile"
          element={
            <PrivatePage>
              <Profile />
            </PrivatePage>
          }
        />

        {/* Unknown routes */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
