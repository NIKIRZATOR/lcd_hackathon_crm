import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx';

import type { DashboardProgramDemandItem } from '../../pages/home/components/DashboardProgramDemandTable/types';

export const exportProgramDemandToExcel = (data: DashboardProgramDemandItem[]) => {
  const rows = data.map((item) => ({
    Программа: item.program,
    'ИТ-продукт': item.product,
    Вузов: item.universities,
    Потоков: item.streams,
    Обучающихся: item.students,
    Заявок: item.applications,
    'Индекс востребованности': item.demandIndex,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Востребованность программ');

  XLSX.writeFile(workbook, 'program-demand.xlsx');
};

export const exportProgramDemandToPng = async (element: HTMLElement) => {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  });

  const link = document.createElement('a');

  link.download = 'program-demand.png';
  link.href = dataUrl;
  link.click();
};
