import { Segmented } from 'antd';

import type { ReportType } from '../../types';
import HorizontalScroll from '../../../../components/horizontalScroll/HorizontalScroll';

type ReportsTypeSwitcherProps = {
  value: ReportType;
  availableReportTypes: ReportType[];
  onChange: (value: ReportType) => void;
};

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  programs: 'Программы',
  'programs-rating': 'Рейтинг образовательных программ',
  manager: 'Менеджеры',
};

const ReportsTypeSwitcher = ({
  value,
  availableReportTypes,
  onChange,
}: ReportsTypeSwitcherProps) => {
  return (
    <HorizontalScroll>
      <Segmented
        value={value}
        options={availableReportTypes.map((type) => ({
          value: type,
          label: REPORT_TYPE_LABELS[type],
        }))}
        onChange={(value) => onChange(value as ReportType)}
      />
    </HorizontalScroll>
  );
};

export default ReportsTypeSwitcher;
