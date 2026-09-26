import { Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '../auth';
import Layout from '../layout';
import AnalyticsPage from '../pages/analytics/AnalyticsPage';
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

import V2Layout from '../v2/app/V2Layout';
import ManagementPage from '../v2/pages/ManagementPage';
import NbaTodayPage from '../v2/pages/NbaTodayPage';
import ProgramDetailPage from '../v2/pages/ProgramDetailPage';
import V2PlaceholderPage from '../v2/pages/V2PlaceholderPage';
import { allowedRoles } from './constants';
import StartRoute from './StartRoute';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<StartRoute />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute allowedRoles={allowedRoles}>
            <V2Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/v2">
          <Route index element={<NbaTodayPage />} />
          <Route path="organizations" element={<UniversitiesPage />} />
          <Route path="organizations/:id" element={<UniversityDetailPage />} />
          <Route path="workflows" element={<WorkflowPage />} />
          <Route path="workflows/:id" element={<WorkflowDetailPage />} />
          <Route path="programs/:id" element={<ProgramDetailPage />} />
          <Route path="reports" element={<V2PlaceholderPage title="Отчёты" description="Конструктор и очередь отчётов будут подключены на этапе Reports MVP." />} />
          <Route
            path="management"
            element={
              <ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}>
                <ManagementPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Route>

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
