import { Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '../auth';
import Layout from '../layout';
import AnalyticsPage from '../pages/analytics/AnalyticsPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import LoginPage from '../pages/login/LoginPage';
import ProductsPage from '../pages/products/ProductsPage';
import ProgramsPage from '../pages/programs/ProgramsPage';
import RatingPage from '../pages/rating/RatingPage';
import ReportsPage from '../pages/reports/ReportsPage';
import TasksPage from '../pages/tasks/TasksPage';
import UniversitiesPage from '../pages/universities/UniversitiesPage';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute allowedRoles={['KAM', 'MANAGER', 'ADMIN']}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />

        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/universities" element={<UniversitiesPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/programs" element={<ProgramsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/rating" element={<RatingPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
