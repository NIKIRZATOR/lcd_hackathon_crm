import { Alert, Flex, Spin } from 'antd';
import { useEffect, useState } from 'react';

import { apiRequest } from '../../../../api/client';
import ProgramsReportFilters from './components/ProgramsReportFilters/ProgramsReportFilters';
import ProgramsReportTable from './components/ProgramsReportTable/ProgramsReportTable';
import { useProgramsReportSearchParams } from './hooks/useProgramsReportSearchParams';
import type { ProgramReportItem, ProgramsReportFilterOptions, ProgramsReportFiltersValues } from './types';

const EMPTY_FILTERS: ProgramsReportFiltersValues = { period: null, universityIds: [], directionIds: [], productIds: [], responsibleIds: [], playbookIds: [] };
type Preview = { items: ProgramReportItem[]; total: number; aggregates: Record<string, number> };

const ProgramsReport = () => {
  const { filters, setFilters } = useProgramsReportSearchParams();
  const [options, setOptions] = useState<ProgramsReportFilterOptions>();
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState('');
  useEffect(() => { apiRequest<{ organizations: ProgramsReportFilterOptions['universities']; directions: ProgramsReportFilterOptions['directions']; products: ProgramsReportFilterOptions['products']; responsibles: ProgramsReportFilterOptions['responsibles']; playbooks: ProgramsReportFilterOptions['playbooks'] }>('/api/reports/filter-options').then((data) => setOptions({ universities: data.organizations, directions: data.directions, products: data.products, responsibles: data.responsibles, playbooks: data.playbooks })).catch(() => setError('Не удалось загрузить фильтры отчёта.')); }, []);
  useEffect(() => {
    const period = filters.period;
    const payload = { organization_ids: filters.universityIds, direction_ids: filters.directionIds, product_ids: filters.productIds, responsible_user_ids: filters.responsibleIds, playbook_ids: filters.playbookIds, date_from: period?.[0]?.toISOString(), date_to: period?.[1]?.endOf('day').toISOString(), sort_by: 'organization', sort_order: 'asc' };
    apiRequest<Preview>('/api/reports/programs/preview?limit=100&offset=0', { method: 'POST', body: JSON.stringify(payload) }).then((data) => { setPreview(data); setError(''); }).catch(() => setError('Не удалось сформировать отчёт.'));
  }, [filters]);
  return <Flex vertical gap={20}>{error && <Alert type="error" showIcon message={error} />}{options ? <ProgramsReportFilters options={options} initialValues={filters} resetValues={EMPTY_FILTERS} onApply={setFilters} onReset={() => setFilters(EMPTY_FILTERS)} /> : <Spin />}<ProgramsReportTable items={preview?.items ?? []} total={preview?.total ?? 0} aggregates={preview?.aggregates} /></Flex>;
};
export default ProgramsReport;
