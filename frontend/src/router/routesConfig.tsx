import type { ReactNode } from 'react';

import AnalyticsPage from '../pages/analytics/AnalyticsPage';
import HomePage from '../pages/home/HomePage';
import ProductsPage from '../pages/products/ProductsPage';
import ProgramsPage from '../pages/programs/ProgramsPage';
import RatingPage from '../pages/rating/RatingPage';
import ReportsPage from '../pages/reports/ReportsPage';
import TasksPage from '../pages/tasks/TasksPage';
import UniversitiesPage from '../pages/universities/UniversitiesPage';
import UniversityDetailPage from '../pages/universities/UniversityDetailPage';
import WorkflowPage from '../pages/workflow/WorkflowPage';
import WorkflowEditPage from '../pages/workflow/WorkflowEditPage';

export interface AppRoute {
  path: string;
  title: string;
  element: ReactNode;
  parent?: string;
}

export const routesConfig: AppRoute[] = [
  {
    path: '/',
    title: 'Главная',
    element: <HomePage />,
  },
  {
    path: '/universities',
    title: 'Организации',
    element: <UniversitiesPage />,
    parent: '/',
  },
  {
    path: '/universities/:id',
    title: 'Карточка организации',
    element: <UniversityDetailPage />,
    parent: '/universities',
  },
  {
    path: '/workflow',
    title: 'Workflow',
    element: <WorkflowPage />,
    parent: '/',
  },
  {
    path: '/workflow/:id/edit',
    title: 'Редактирование workflow',
    element: <WorkflowEditPage />,
    parent: '/workflow',
  },
  {
    path: '/tasks',
    title: 'Задачи',
    element: <TasksPage />,
    parent: '/',
  },
  {
    path: '/programs',
    title: 'Программы',
    element: <ProgramsPage />,
    parent: '/',
  },
  {
    path: '/products',
    title: 'ИТ-продукты',
    element: <ProductsPage />,
    parent: '/',
  },
  {
    path: '/analytics',
    title: 'Аналитика',
    element: <AnalyticsPage />,
    parent: '/',
  },
  {
    path: '/rating',
    title: 'Рейтинг',
    element: <RatingPage />,
    parent: '/',
  },
  {
    path: '/reports',
    title: 'Отчёты',
    element: <ReportsPage />,
    parent: '/',
  },
];
