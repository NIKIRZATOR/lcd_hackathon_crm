import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { ReportType } from '../types';

const REPORT_QUERY_KEY = 'report';

const DEFAULT_REPORT_TYPE: ReportType = 'interactions';

type UseReportTypeParams = {
  availableReportTypes: ReportType[];
};

export const useReportType = ({ availableReportTypes }: UseReportTypeParams) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const reportType = useMemo<ReportType>(() => {
    const value = searchParams.get(REPORT_QUERY_KEY) as ReportType | null;

    if (value && availableReportTypes.includes(value)) {
      return value;
    }

    return DEFAULT_REPORT_TYPE;
  }, [availableReportTypes, searchParams]);

  const setReportType = useCallback(
    (value: ReportType) => {
      if (!availableReportTypes.includes(value)) {
        return;
      }

      setSearchParams((currentParams) => {
        const params = new URLSearchParams(currentParams);

        params.set(REPORT_QUERY_KEY, value);

        return params;
      });
    },
    [availableReportTypes, setSearchParams],
  );

  return {
    reportType,
    setReportType,
  };
};
