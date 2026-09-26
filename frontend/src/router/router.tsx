import { Navigate, Route, Routes } from 'react-router-dom';

import StartRoute from './StartRoute';
import { ProtectedRoute } from '../auth';
import { allowedRoles } from './constants';
import Layout from '../layout';
import LoginPage from '../pages/login/LoginPage';

import HomePage from '../pages/home/HomePage';
import UniversitiesPage from '../pages/universities/UniversitiesPage';
import UniversityDetailPage from '../pages/universities/UniversityDetailPage';
import WorkflowPage from '../pages/workflow/WorkflowPage';
import WorkflowDetailPage from '../pages/workflow/WorkflowDetailPage';
import WorkflowEditPage from '../pages/workflow/WorkflowEditPage';
import ReportsPage from '../pages/reports/ReportsPage';

//импорты для v2
import V2Layout from '../v2/app/V2Layout';
import NbaTodayPage from '../v2/pages/NbaTodayPage';
import OrganizationsPage from '../v2/pages/OrganizationsPage';
import OrganizationDetailPage from '../v2/pages/OrganizationDetailPage';
import WorkflowJournalPage from '../v2/pages/WorkflowJournalPage';
import ProgramDetailPage from '../v2/pages/ProgramDetailPage';
import V2PlaceholderPage from '../v2/pages/V2PlaceholderPage';
import ManagementPage from '../v2/pages/ManagementPage';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<StartRoute />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Текущая версия приложения */}
      <Route
        element={
          <ProtectedRoute allowedRoles={allowedRoles}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<HomePage />} />

        <Route path="/universities" element={<UniversitiesPage />} />
        <Route path="/universities/:id" element={<UniversityDetailPage />} />

        <Route path="/workflow" element={<WorkflowPage />} />
        <Route path="/workflow/:id" element={<WorkflowDetailPage />} />
        <Route path="/workflow/:id/edit" element={<WorkflowEditPage />} />

        <Route path="/reports" element={<ReportsPage />} />
      </Route>

      {/* страницы от Никиты */}
      <Route
        path="/v2"
        element={
          <ProtectedRoute allowedRoles={allowedRoles}>
            <V2Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<NbaTodayPage />} />

        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="organizations/:id" element={<OrganizationDetailPage />} />

        <Route path="workflows" element={<WorkflowJournalPage />} />

        <Route path="programs/:id" element={<ProgramDetailPage />} />

        <Route
          path="reports"
          element={<V2PlaceholderPage title="Отчёты" description="Раздел находится в разработке" />}
        />

        <Route path="management" element={<ManagementPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
