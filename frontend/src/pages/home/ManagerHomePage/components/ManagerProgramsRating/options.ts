import type { CustomSeriesOption } from 'echarts/charts';
import type { EChartsCoreOption } from 'echarts/core';

import type { ManagerProgramsRatingItem } from '../../types';

type ManagerProgramsRatingChartTheme = {
  primaryColor: string;
  trackColor: string;
  textColor: string;
  textSecondaryColor: string;
  fontFamily: string;
};

const MAX_INDEX = 100;

const clampIndex = (value: number) => {
  return Math.min(Math.max(value, 0), MAX_INDEX);
};

export const getManagerProgramsRatingOption = (
  items: ManagerProgramsRatingItem[],
  chartTheme: ManagerProgramsRatingChartTheme,
): EChartsCoreOption => {
  const sortedItems = [...items]
    .sort((first, second) => second.demandIndex - first.demandIndex)
    .slice(0, 3);

  const series: CustomSeriesOption = {
    type: 'custom',
    coordinateSystem: 'cartesian2d',
    clip: false,

    renderItem: (_params, api) => {
      const itemIndex = Number(api.value(1));
      const item = sortedItems[itemIndex];

      if (!item) {
        return;
      }

      const value = clampIndex(item.demandIndex);

      const start = api.coord([0, itemIndex]);
      const end = api.coord([MAX_INDEX, itemIndex]);
      const valueEnd = api.coord([value, itemIndex]);

      const left = start[0];
      const right = end[0];
      const centerY = start[1];

      const trackWidth = right - left;
      const valueWidth = Math.max(valueEnd[0] - left, 0);

      const titleY = centerY - 25;
      const barY = centerY - 5;
      const metaY = centerY + 18;

      const rankWidth = 22;
      const indexWidth = 48;

      return {
        type: 'group',

        children: [
          {
            type: 'text',

            style: {
              x: left,
              y: titleY,

              text: String(itemIndex + 1),

              fill: chartTheme.textSecondaryColor,

              fontSize: 13,
              fontWeight: 500,
              fontFamily: chartTheme.fontFamily,

              verticalAlign: 'middle',
            },
          },

          {
            type: 'text',

            style: {
              x: left + rankWidth,
              y: titleY,

              text: item.program,

              width: Math.max(trackWidth - rankWidth - indexWidth, 0),
              overflow: 'truncate',
              ellipsis: '…',

              fill: chartTheme.textColor,

              fontSize: 14,
              fontWeight: 600,
              fontFamily: chartTheme.fontFamily,

              verticalAlign: 'middle',
            },
          },

          {
            type: 'text',

            style: {
              x: right,
              y: titleY,

              text: String(item.demandIndex),

              fill: chartTheme.textColor,

              fontSize: 14,
              fontWeight: 600,
              fontFamily: chartTheme.fontFamily,

              align: 'right',
              verticalAlign: 'middle',
            },
          },

          {
            type: 'rect',

            shape: {
              x: left,
              y: barY,
              width: trackWidth,
              height: 10,
              r: 5,
            },

            style: {
              fill: chartTheme.trackColor,
            },
          },

          {
            type: 'rect',

            shape: {
              x: left,
              y: barY,
              width: valueWidth,
              height: 10,
              r: 5,
            },

            style: {
              fill: chartTheme.primaryColor,
            },
          },

          {
            type: 'text',

            style: {
              x: left,
              y: metaY,

              text: `Заявки ${item.applications} · Студенты ${item.students} · Потоки ${item.streams}`,

              fill: chartTheme.textSecondaryColor,

              fontSize: 12,
              fontWeight: 400,
              fontFamily: chartTheme.fontFamily,

              verticalAlign: 'middle',
            },
          },
        ],
      };
    },

    data: sortedItems.map((item, index) => ({
      name: item.program,
      value: [item.demandIndex, index],
    })),
  };

  return {
    animationDuration: 300,

    tooltip: {
      show: true,
      trigger: 'item',
      confine: true,
      renderMode: 'html',

      backgroundColor: '#FFFFFF',
      borderColor: '#E2D5F7',
      borderWidth: 1,
      padding: [8, 10],

      textStyle: {
        color: '#252632',
        fontSize: 13,
        lineHeight: 18,
      },

      extraCssText: `
    max-width: 220px;
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(37, 38, 50, 0.12);
    white-space: normal;
    word-break: break-word;
  `,

      formatter: '{b}',
    },
    grid: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      containLabel: false,
    },

    xAxis: {
      type: 'value',
      min: 0,
      max: MAX_INDEX,
      show: false,
    },

    yAxis: {
      type: 'category',
      inverse: true,
      show: false,
      data: sortedItems.map((item) => item.program),
    },

    series: [series],
  };
};
