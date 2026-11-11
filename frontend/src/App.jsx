import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TutorDashboard from "./pages/TutorDashboard";
import StudentBookings from "./pages/Studentbookings/StudentBookings";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tutor-dashboard" element={<TutorDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/student-bookings" element={<StudentBookings />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
