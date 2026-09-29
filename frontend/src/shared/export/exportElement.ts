import { toJpeg, toPng, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';

import { downloadBlob } from './download';

export type ElementExportFormat = 'png' | 'jpeg' | 'svg' | 'pdf';

const EXPORT_OPTIONS = {
  cacheBust: true,
  pixelRatio: 2,
  backgroundColor: '#ffffff',
  filter: (node: HTMLElement) => node.dataset?.exportIgnore !== 'true',
};

const downloadDataUrl = (dataUrl: string, fileName: string) => {
  const link = document.createElement('a');

  link.download = fileName;
  link.href = dataUrl;

  link.click();
};

const dataUrlToBlob = async (dataUrl: string) => {
  const response = await fetch(dataUrl);

  return response.blob();
};

const exportPng = async (element: HTMLElement, fileName: string) => {
  const dataUrl = await toPng(element, EXPORT_OPTIONS);

  downloadDataUrl(dataUrl, `${fileName}.png`);
};

const exportJpeg = async (element: HTMLElement, fileName: string) => {
  const dataUrl = await toJpeg(element, {
    ...EXPORT_OPTIONS,
    quality: 1,
  });

  downloadDataUrl(dataUrl, `${fileName}.jpeg`);
};

const exportSvg = async (element: HTMLElement, fileName: string) => {
  const dataUrl = await toSvg(element, {
    ...EXPORT_OPTIONS,
    pixelRatio: 1,
  });

  const blob = await dataUrlToBlob(dataUrl);

  downloadBlob(blob, `${fileName}.svg`);
};

const exportPdf = async (element: HTMLElement, fileName: string) => {
  const dataUrl = await toPng(element, EXPORT_OPTIONS);

  const width = element.offsetWidth;
  const height = element.offsetHeight;

  const orientation = width >= height ? 'landscape' : 'portrait';

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const margin = 10;

  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;

  const scale = Math.min(availableWidth / width, availableHeight / height);

  const imageWidth = width * scale;
  const imageHeight = height * scale;

  const x = (pageWidth - imageWidth) / 2;
  const y = (pageHeight - imageHeight) / 2;

  pdf.addImage(dataUrl, 'PNG', x, y, imageWidth, imageHeight);

  pdf.save(`${fileName}.pdf`);
};

export const exportElement = async (
  element: HTMLElement,
  format: ElementExportFormat,
  fileName: string,
) => {
  if (format === 'png') {
    await exportPng(element, fileName);

    return;
  }

  if (format === 'jpeg') {
    await exportJpeg(element, fileName);

    return;
  }

  if (format === 'svg') {
    await exportSvg(element, fileName);

    return;
  }

  await exportPdf(element, fileName);
};
