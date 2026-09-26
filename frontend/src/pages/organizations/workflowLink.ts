import dayjs from 'dayjs';
import 'dayjs/locale/ru';

import { universityItemsMock } from './mocks';
import { nextWorkflowStepName, workflowItemsMock } from '../workflow/mocks';
import { universityWorkflowRows } from '../workflow/api';
import type { WorkflowItem, WorkflowStatus } from '../workflow/types';
import type { StageTone } from './universityCard';

const normalize = (value: string) => value.trim().toLowerCase().replace(/ё/g, 'е').replace(/[«»"']/g, '');

const matchUniversity = (item: WorkflowItem) => {
  const shortName = normalize(item.universityShort);
  const name = normalize(item.university);
  const exact = universityItemsMock.filter((university) => normalize(university.shortName) === shortName || normalize(university.name) === name);
  if (exact.length > 0) return exact[0];

  const fuzzy = universityItemsMock.filter((university) => {
    const universityShort = normalize(university.shortName);
    const universityName = normalize(university.name);
    return universityShort.includes(shortName) || universityName.includes(name) || shortName.includes(universityShort);
  });
  return fuzzy.length === 1 ? fuzzy[0] : undefined;
};

export const linkWorkflowsToUniversities = () => {
  workflowItemsMock.forEach((item) => {
    if (item.universityId) return;
    const university = matchUniversity(item);
    if (university) item.universityId = university.id;
  });
};

linkWorkflowsToUniversities();

const stageTone = (stage: string): StageTone => {
  if (/поиск|соглас/i.test(stage)) return 'danger';
  if (/коммуник|работ|встреч/i.test(stage)) return 'progress';
  if (/подпис|документ/i.test(stage)) return 'warning';
  if (/обучен|внедр|контрол/i.test(stage)) return 'success';
  return 'neutral';
};

export const listUniversityWorkflows = (universityId: number | string) => {
  const live = universityWorkflowRows(universityId);
  if (live) return live;

  linkWorkflowsToUniversities();
  return workflowItemsMock
    .filter((item) => item.universityId === universityId)
    .map((item) => ({
      id: item.id,
      program: item.program,
      product: item.product,
      stage: item.stage,
      tone: stageTone(item.stage),
      nextStep: nextWorkflowStepName(item.id, item.stage),
      due: dayjs(item.deadline).isValid() ? dayjs(item.deadline).locale('ru').format('D MMM YYYY') : item.deadline,
      owner: item.responsible,
      status: item.status satisfies WorkflowStatus,
      at: item.deadline,
    }));
};

