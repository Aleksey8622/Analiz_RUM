import { Navigate, Route, Routes } from 'react-router-dom';
import AuthPage from './features/auth/AuthPage';
import DashboardPage from './features/dashboard/DashboardPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route path="/workspace" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
