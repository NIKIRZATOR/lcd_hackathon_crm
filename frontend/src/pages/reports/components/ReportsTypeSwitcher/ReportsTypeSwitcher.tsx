import { Segmented } from 'antd';

import type { ReportType } from '../../types';

type ReportsTypeSwitcherProps = {
  value: ReportType;
  availableReportTypes: ReportType[];
  onChange: (value: ReportType) => void;
};

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  interactions: 'Взаимодействия',
  programs: 'Программы',
  manager: 'Менеджеры',
};

const ReportsTypeSwitcher = ({
  value,
  availableReportTypes,
  onChange,
}: ReportsTypeSwitcherProps) => {
  return (
    <Segmented
      value={value}
      options={availableReportTypes.map((type) => ({
        value: type,
        label: REPORT_TYPE_LABELS[type],
      }))}
      onChange={(value) => onChange(value as ReportType)}
    />
  );
};

export default ReportsTypeSwitcher;

