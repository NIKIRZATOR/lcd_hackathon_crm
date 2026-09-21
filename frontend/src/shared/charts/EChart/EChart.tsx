import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';

import ReactEChartsCore from 'echarts-for-react/esm/core';

import { echarts } from './echarts';

type EChartProps = {
  option: EChartsCoreOption;
  className?: string;
};

export type EChartRef = {
  getInstance: () => EChartsType | null;
};

const EChart = forwardRef<EChartRef, EChartProps>(({ option, className }, ref) => {
  const chartRef = useRef<ReactEChartsCore>(null);

  useImperativeHandle(ref, () => ({
    getInstance: () => chartRef.current?.getEchartsInstance() ?? null,
  }));

  return (
    <ReactEChartsCore
      ref={chartRef}
      echarts={echarts}
      option={option}
      opts={{
        renderer: 'svg',
        locale: 'RU',
      }}
      className={className}
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
});

EChart.displayName = 'EChart';

export default EChart;
