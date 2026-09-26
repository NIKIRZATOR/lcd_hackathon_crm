import type { LineSeriesOption } from 'echarts/charts';
import type { TooltipComponentOption } from 'echarts/components';
import type { EChartsCoreOption } from 'echarts/core';

import type { DashboardDynamicsPoint } from './types';

type DashboardDynamicsColors = {
  applications: string;
  students: string;
  streams: string;

  text: string;
  textSecondary: string;

  border: string;
  tooltipBackground: string;
};

const numberFormatter = new Intl.NumberFormat('ru-RU');

const tooltipDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const createTooltip = (colors: DashboardDynamicsColors): TooltipComponentOption => ({
  trigger: 'axis',

  backgroundColor: colors.tooltipBackground,
  borderColor: colors.border,

  textStyle: {
    color: colors.text,
  },

  axisPointer: {
    type: 'line',

    lineStyle: {
      color: colors.border,
    },
  },

  formatter: (params) => {
    const items = Array.isArray(params) ? params : [params];

    if (!items.length) {
      return '';
    }

    const firstValue = items[0].value;

    if (!Array.isArray(firstValue)) {
      return '';
    }

    const dateValue = firstValue[0];

    const date = tooltipDateFormatter.format(new Date(String(dateValue)));

    const values = items
      .map((item) => {
        const value = Array.isArray(item.value) ? item.value[1] : item.value;

        return `
          <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
          ">
            <span>
              ${item.marker}
              ${item.seriesName}
            </span>

            <strong>
              ${numberFormatter.format(Number(value))}
            </strong>
          </div>
        `;
      })
      .join('');

    return `
      <div style="margin-bottom: 6px;">
        ${date}
      </div>

      ${values}
    `;
  },
});

const createLineSeries = (
  name: string,
  data: Array<[string, number]>,
  color: string,
): LineSeriesOption => ({
  name,
  type: 'line',

  data,

  smooth: 0.2,

  symbol: 'circle',
  symbolSize: 6,

  sampling: 'lttb',

  lineStyle: {
    width: 2,
    color,
  },

  itemStyle: {
    color,
    borderColor: '#FFFFFF',
    borderWidth: 2,
  },

  areaStyle: {
    color,
    opacity: 0,
  },

  emphasis: {
    focus: 'series',
    scale: true,

    lineStyle: {
      width: 3,
    },

    areaStyle: {
      color,
      opacity: 0.08,
    },
  },

  endLabel: {
    show: true,

    formatter: (params) => {
      const value = params.value;
      const numericValue = Array.isArray(value) ? value[1] : value;

      return numberFormatter.format(Number(numericValue));
    },

    color: '#FFFFFF',
    backgroundColor: color,

    padding: [5, 8],
    borderRadius: 6,

    fontSize: 12,
    fontWeight: 600,

    distance: 8,
  },

  labelLayout: {
    moveOverlap: 'shiftY',
  },
});

export const getDashboardDynamicsOptions = (
  data: DashboardDynamicsPoint[],
  colors: DashboardDynamicsColors,
): EChartsCoreOption => ({
  animationDuration: 400,

  grid: {
    top: 52,
    right: 80,
    bottom: 32,
    left: 52,
  },

  legend: {
    top: 0,
    left: 0,

    icon: 'circle',

    itemWidth: 10,
    itemHeight: 10,
    itemGap: 28,

    textStyle: {
      color: colors.textSecondary,
      fontSize: 14,
    },
  },

  tooltip: createTooltip(colors),

  xAxis: {
    type: 'time',

    axisLine: {
      lineStyle: {
        color: colors.border,
      },
    },

    axisTick: {
      show: false,
    },

    axisLabel: {
      color: colors.textSecondary,
      hideOverlap: true,
    },

    splitLine: {
      show: true,

      lineStyle: {
        color: colors.border,
      },
    },
  },

  yAxis: {
    type: 'value',

    min: 0,

    axisLine: {
      show: false,
    },

    axisTick: {
      show: false,
    },

    axisLabel: {
      color: colors.textSecondary,

      formatter: (value: number) => numberFormatter.format(value),
    },

    splitLine: {
      show: true,

      lineStyle: {
        color: colors.border,
      },
    },
  },

  series: [
    createLineSeries(
      'Заявки',
      data.map(({ date, applications }) => [date, applications]),
      colors.applications,
    ),

    createLineSeries(
      'Обучающиеся',
      data.map(({ date, students }) => [date, students]),
      colors.students,
    ),

    createLineSeries(
      'Потоки',
      data.map(({ date, streams }) => [date, streams]),
      colors.streams,
    ),
  ],
});
