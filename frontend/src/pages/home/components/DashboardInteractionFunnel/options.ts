import type { EChartsCoreOption } from 'echarts/core';

import type { DashboardInteractionFunnelItem } from './types';

type DashboardInteractionFunnelColors = {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
};

export const getDashboardInteractionFunnelOptions = (
  data: DashboardInteractionFunnelItem[],
  colors: DashboardInteractionFunnelColors,
): EChartsCoreOption => {
  const maxValue = Math.max(...data.map(({ value }) => value));

  return {
    animation: false,

    grid: {
      top: 0,
      right: 40,
      bottom: 0,
      left: 0,
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
        color: colors.textColor,
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
          color: colors.backgroundColor,
          borderRadius: 4,
        },

        itemStyle: {
          color: colors.primaryColor,
          borderRadius: 4,
        },

        label: {
          show: true,
          position: 'right',
          distance: 12,
          color: colors.textColor,
          fontSize: 12,
          formatter: '{c}',
        },
      },
    ],
  };
};
