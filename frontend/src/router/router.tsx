import { Navigate, Route, Routes, useParams } from 'react-router-dom';

import { ProtectedRoute } from '../auth';
import AppLayout from '../layout/AppLayout';
import HomePage from '../pages/home/HomePage';
import LoginPage from '../pages/login/LoginPage';
import ProfilePage from '../pages/profile/ProfilePage';
import ManagementPage from '../pages/management/ManagementPage';
import PlaybookEditorPage from '../pages/management/playbookEditor/PlaybookEditorPage';
import OrganizationDetailPage from '../pages/organizations/UniversityDetailPage';
import OrganizationsPage from '../pages/organizations/UniversitiesPage';
import ProgramDetailPage from '../pages/programs/ProgramDetailPage';
import ReportsPage from '../pages/reports/ReportsPage';
import WorkflowDetailPage from '../pages/workflow/WorkflowDetailPage';
import WorkflowPage from '../pages/workflow/WorkflowPage';
import { allowedRoles } from './constants';
import StartRoute from './StartRoute';

const LegacyWorkflowRedirect = () => {
  const { id } = useParams();

  return <Navigate to={id ? `/workflows/${id}` : '/workflows'} replace />;
};

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
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/organizations" element={<OrganizationsPage />} />
      <Route path="/organizations/:id" element={<OrganizationDetailPage />} />
      <Route path="/workflows" element={<WorkflowPage />} />
      <Route path="/workflows/:id" element={<WorkflowDetailPage />} />
      <Route path="/programs/:id" element={<ProgramDetailPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/tasks" element={<Navigate to="/home" replace />} />
      <Route path="/programs" element={<Navigate to="/workflows" replace />} />
      <Route path="/products" element={<Navigate to="/organizations" replace />} />
      <Route path="/analytics" element={<Navigate to="/reports" replace />} />
      <Route path="/rating" element={<Navigate to="/reports?report=programs-rating" replace />} />
      <Route path="/universities" element={<Navigate to="/organizations" replace />} />
      <Route path="/universities/:id" element={<Navigate to="/organizations" replace />} />
      <Route path="/workflow" element={<Navigate to="/workflows" replace />} />
      <Route path="/workflow/:id" element={<LegacyWorkflowRedirect />} />
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

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRoutes;
