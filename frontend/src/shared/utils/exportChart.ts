import type { EChartsType } from 'echarts/core';

export type ChartExportFormat = 'png' | 'jpeg' | 'svg';

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
};

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

const downloadRasterImage = (chart: EChartsType, format: 'png' | 'jpeg', fileName: string) => {
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
      return;
    }

    context.scale(pixelRatio, pixelRatio);

    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, width, height);

    context.drawImage(image, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          return;
        }

        downloadBlob(blob, `${fileName}.${format}`);
      },
      `image/${format}`,
      1,
    );

    URL.revokeObjectURL(svgUrl);
  };

  image.onerror = () => {
    URL.revokeObjectURL(svgUrl);
  };

  image.src = svgUrl;
};

export const exportChart = (chart: EChartsType, format: ChartExportFormat, fileName: string) => {
  if (format === 'svg') {
    downloadSvg(chart, fileName);

    return;
  }

  downloadRasterImage(chart, format, fileName);
};
