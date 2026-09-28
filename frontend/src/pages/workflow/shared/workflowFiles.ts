const allowedExtensions = new Set([
  'png',
  'jpeg',
  'jpg',
  'pdf',
  'zip',
  'gz',
  'gzip',
  'rar',
  'doc',
  'docx',
  'xls',
  'xlsx',
]);

export const workflowFileRejectionMessage =
  'Можно приложить только файлы форматов png, jpeg, pdf, zip, gzip, rar, doc, docx, xls, xlsx';

export const workflowFileExtension = (fileName: string) => {
  const extension = fileName.split('.').pop()?.trim().toLowerCase() ?? '';

  if (!extension || extension === fileName.trim().toLowerCase()) return '';

  return extension;
};

export const isAllowedWorkflowFile = (fileName: string) => allowedExtensions.has(workflowFileExtension(fileName));

export const workflowFileTypeLabel = (fileName: string) => {
  const extension = workflowFileExtension(fileName);

  if (extension === 'jpg' || extension === 'jpeg') return 'JPEG';
  if (extension === 'gz' || extension === 'gzip') return 'GZIP';

  return extension ? extension.toUpperCase() : 'FILE';
};
