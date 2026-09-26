import type { EChartsType } from 'echarts/core';

import { downloadBlob } from './download';
import type { ChartExportFormat } from './types';

const getSvg = (chart: EChartsType) => {
  const svg = chart.getDom().querySelector('svg');

  if (!svg) {
    throw new Error('SVG element not found');
  }

  return svg;
};

const getSvgString = (chart: EChartsType) => {
  const svg = getSvg(chart);

  return new XMLSerializer().serializeToString(svg);
};

const downloadSvg = (chart: EChartsType, fileName: string) => {
  const svgString = getSvgString(chart);

  const blob = new Blob([svgString], {
    type: 'image/svg+xml;charset=utf-8',
  });

  downloadBlob(blob, `${fileName}.svg`);
};

const downloadRasterImage = (chart: EChartsType, format: 'png' | 'jpeg', fileName: string) =>
  new Promise<void>((resolve, reject) => {
    const svg = getSvg(chart);
    const svgString = new XMLSerializer().serializeToString(svg);

    const svgBlob = new Blob([svgString], {
      type: 'image/svg+xml;charset=utf-8',
    });

    const svgUrl = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      const width = svg.clientWidth;
      const height = svg.clientHeight;

      const pixelRatio = 2;

      const canvas = document.createElement('canvas');

      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;

      const context = canvas.getContext('2d');

      if (!context) {
        URL.revokeObjectURL(svgUrl);

        reject(new Error('Canvas context not found'));

        return;
      }

      context.scale(pixelRatio, pixelRatio);

      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, width, height);

      context.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(svgUrl);

          if (!blob) {
            reject(new Error('Image blob creation failed'));

            return;
          }

          downloadBlob(blob, `${fileName}.${format}`);

          resolve();
        },
        `image/${format}`,
        1,
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(svgUrl);

      reject(new Error('SVG image loading failed'));
    };

    image.src = svgUrl;
  });

export const exportChart = async (
  chart: EChartsType,
  format: ChartExportFormat,
  fileName: string,
) => {
  if (format === 'svg') {
    downloadSvg(chart, fileName);

    return;
  }

  await downloadRasterImage(chart, format, fileName);
};
