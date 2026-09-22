import { findUniversity, rememberUniversity, universityItemsMock, universityManagers, universityProfiles } from './mocks';
import { listUniversityWorkflows } from './workflowLink';

// Страницы ходят только сюда. Сейчас под функциями моки, запросы встанут на их место.

export { findUniversity, rememberUniversity, listUniversityWorkflows };

export const listUniversities = () => universityItemsMock;

export const listUniversityManagers = () => universityManagers;

export const listUniversityProfiles = () => universityProfiles;
