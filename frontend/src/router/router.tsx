import { Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '../auth';
import Layout from '../layout';
import AnalyticsPage from '../pages/analytics/AnalyticsPage';
import HomePage from '../pages/home/HomePage';
import LoginPage from '../pages/login/LoginPage';
import ProductsPage from '../pages/products/ProductsPage';
import ProgramsPage from '../pages/programs/ProgramsPage';
import RatingPage from '../pages/rating/RatingPage';
import ReportsPage from '../pages/reports/ReportsPage';
import TasksPage from '../pages/tasks/TasksPage';
import UniversitiesPage from '../pages/universities/UniversitiesPage';
import UniversityDetailPage from '../pages/universities/UniversityDetailPage';
import WorkflowPage from '../pages/workflow/WorkflowPage';
import WorkflowDetailPage from '../pages/workflow/WorkflowDetailPage';
import WorkflowEditPage from '../pages/workflow/WorkflowEditPage';
import { allowedRoles } from './constants';
import StartRoute from './StartRoute';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<StartRoute />}>
        <Route index element={<HomePage />} />
      </Route>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute allowedRoles={allowedRoles}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/universities" element={<UniversitiesPage />} />
        <Route path="/universities/:id" element={<UniversityDetailPage />} />
        <Route path="/workflow" element={<WorkflowPage />} />
        <Route path="/workflow/:id" element={<WorkflowDetailPage />} />
        <Route path="/workflow/:id/edit" element={<WorkflowEditPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/programs" element={<ProgramsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/rating" element={<RatingPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
