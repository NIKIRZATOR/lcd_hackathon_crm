import 'echarts/i18n/langRU.js';

import { BarChart, CustomChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { LabelLayout } from 'echarts/features';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  CustomChart,
  LineChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  LabelLayout,
  SVGRenderer,
]);

export { echarts };
