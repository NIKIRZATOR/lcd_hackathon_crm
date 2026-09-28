import { Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '../auth';
import AppLayout from '../layout/AppLayout';
import Layout from '../layout';
import AnalyticsPage from '../pages/analytics/AnalyticsPage';
import HomePage from '../pages/home/HomePage';
import LoginPage from '../pages/login/LoginPage';
import ManagementPage from '../pages/management/ManagementPage';
import PlaybookEditorPage from '../pages/management/playbookEditor/PlaybookEditorPage';
import OrganizationDetailPage from '../pages/organizations/UniversityDetailPage';
import OrganizationsPage from '../pages/organizations/UniversitiesPage';
import ProductsPage from '../pages/products/ProductsPage';
import ProgramDetailPage from '../pages/programs/ProgramDetailPage';
import ProgramsPage from '../pages/programs/ProgramsPage';
import RatingPage from '../pages/rating/RatingPage';
import ReportsPage from '../pages/reports/ReportsPage';
import TasksPage from '../pages/tasks/TasksPage';
import UniversitiesPage from '../pages/universities/UniversitiesPage';
import UniversityDetailPage from '../pages/universities/UniversityDetailPage';
import WorkflowDetailPage from '../pages/workflow/WorkflowDetailPage';
import WorkflowPage from '../pages/workflow/WorkflowPage';
import { allowedRoles } from './constants';
import StartRoute from './StartRoute';

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<StartRoute />} />
    <Route path="/login" element={<LoginPage />} />

    <Route
      element={
        <ProtectedRoute allowedRoles={allowedRoles}>
          <AppLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/home" element={<HomePage />} />
      <Route path="/organizations" element={<OrganizationsPage />} />
      <Route path="/organizations/:id" element={<OrganizationDetailPage />} />
      <Route path="/workflows" element={<WorkflowPage />} />
      <Route path="/workflows/:id" element={<WorkflowDetailPage />} />
      <Route path="/programs/:id" element={<ProgramDetailPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route
        path="/management"
        element={
          <ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}>
            <ManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/management/playbooks/:id"
        element={
          <ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']}>
            <PlaybookEditorPage />
          </ProtectedRoute>
        }
      />
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
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRoutes;
