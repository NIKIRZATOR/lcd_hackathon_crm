import type { EChartsCoreOption } from 'echarts/core';

import ReactEChartsCore from 'echarts-for-react/esm/core';

import { echarts } from './echarts';

type EChartProps = {
  option: EChartsCoreOption;
  className?: string;
};

const EChart = ({ option, className }: EChartProps) => {
  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      opts={{ renderer: 'svg' }}
      className={className}
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
};

export default EChart;
