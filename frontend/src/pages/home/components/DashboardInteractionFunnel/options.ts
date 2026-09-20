import type { EChartsCoreOption } from 'echarts/core';

import type { DashboardInteractionFunnelItem } from './types';

export const getDashboardInteractionFunnelOptions = (
  data: DashboardInteractionFunnelItem[],
): EChartsCoreOption => {
  const maxValue = Math.max(...data.map(({ value }) => value));

  return {
    animation: false,

    grid: {
      top: 0,
      right: 40,
      bottom: 0,
      left: 0,
      containLabel: true,
    },

    xAxis: {
      type: 'value',
      max: maxValue,
      show: false,
    },

    yAxis: {
      type: 'category',
      inverse: true,
      data: data.map(({ stage }) => stage),

      axisLine: {
        show: false,
      },

      axisTick: {
        show: false,
      },

      axisLabel: {
        color: '#252632',
        fontSize: 12,
        margin: 16,
      },
    },

    series: [
      {
        type: 'bar',

        data: data.map(({ value }) => value),

        barWidth: 16,

        showBackground: true,

        backgroundStyle: {
          color: '#F3F5F9',
          borderRadius: 4,
        },

        itemStyle: {
          color: '#6B9DF8',
          borderRadius: 4,
        },

        label: {
          show: true,
          position: 'right',
          distance: 12,
          color: '#252632',
          fontSize: 12,
          formatter: '{c}',
        },
      },
    ],
  };
};
