import { Alert, Flex, Spin } from 'antd';
import { useEffect, useState } from 'react';

import { apiDownload, apiRequest } from '../../../../api/client';
import type { TableExportFormat } from '../../../../shared/export/types';
import ProgramsReportFilters from './components/ProgramsReportFilters/ProgramsReportFilters';
import ProgramsReportTable from './components/ProgramsReportTable/ProgramsReportTable';
import { useProgramsReportSearchParams } from './hooks/useProgramsReportSearchParams';
import type { ProgramReportItem, ProgramsReportFilterOptions, ProgramsReportFiltersValues } from './types';

const EMPTY_FILTERS: ProgramsReportFiltersValues = { period: null, universityIds: [], directionIds: [], productIds: [], responsibleIds: [], playbookIds: [] };
type Preview = { items: ProgramReportItem[]; total: number; aggregates: Record<string, number> };
type ReportJob = { id: string; status: string; error_message?: string };

const ProgramsReport = () => {
  const { filters, setFilters } = useProgramsReportSearchParams();
  const [options, setOptions] = useState<ProgramsReportFilterOptions>();
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const reportPayload = () => {
    const period = filters.period;
    return { organization_ids: filters.universityIds, direction_ids: filters.directionIds, product_ids: filters.productIds, responsible_user_ids: filters.responsibleIds, playbook_ids: filters.playbookIds, date_from: period?.[0]?.toISOString(), date_to: period?.[1]?.endOf('day').toISOString(), sort_by: 'organization', sort_order: 'asc' };
  };
  useEffect(() => { apiRequest<{ organizations: ProgramsReportFilterOptions['universities']; directions: ProgramsReportFilterOptions['directions']; products: ProgramsReportFilterOptions['products']; responsibles: ProgramsReportFilterOptions['responsibles']; playbooks: ProgramsReportFilterOptions['playbooks'] }>('/api/reports/filter-options').then((data) => setOptions({ universities: data.organizations, directions: data.directions, products: data.products, responsibles: data.responsibles, playbooks: data.playbooks })).catch(() => setError('Не удалось загрузить фильтры отчёта.')); }, []);
  useEffect(() => {
    apiRequest<Preview>('/api/reports/programs/preview?limit=100&offset=0', { method: 'POST', body: JSON.stringify(reportPayload()) }).then((data) => { setPreview(data); setError(''); }).catch(() => setError('Не удалось сформировать отчёт.'));
  }, [filters]);
  const download = async (format: TableExportFormat, columns: string[]) => {
    setExportStatus('Формируем файл отчёта…');
    try {
      const job = await apiRequest<ReportJob>('/api/reports/jobs', { method: 'POST', body: JSON.stringify({ format: format.toUpperCase(), filter: reportPayload(), columns }) });
      let current = job;
      for (let attempt = 0; attempt < 60 && current.status !== 'DONE'; attempt += 1) {
        if (current.status === 'FAILED') throw new Error(current.error_message || 'Не удалось сформировать файл.');
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        current = await apiRequest<ReportJob>(`/api/reports/jobs/${job.id}`);
      }
      if (current.status !== 'DONE') throw new Error('Файл формируется дольше обычного. Попробуйте скачать его немного позже.');
      const blob = await apiDownload(`/api/reports/jobs/${job.id}/download`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `programs-report.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      setExportStatus('Файл готов и скачан.');
    } catch (downloadError) {
      setExportStatus(downloadError instanceof Error ? downloadError.message : 'Не удалось сформировать файл.');
    }
  };
  return <Flex vertical gap={20}>{error && <Alert type="error" showIcon message={error} />}{exportStatus && <Alert type={exportStatus === 'Файл готов и скачан.' ? 'success' : 'info'} showIcon message={exportStatus} />}{options ? <ProgramsReportFilters options={options} initialValues={filters} resetValues={EMPTY_FILTERS} onApply={setFilters} onReset={() => setFilters(EMPTY_FILTERS)} /> : <Spin />}<ProgramsReportTable items={preview?.items ?? []} total={preview?.total ?? 0} aggregates={preview?.aggregates} onDownload={download} /></Flex>;
};
export default ProgramsReport;
