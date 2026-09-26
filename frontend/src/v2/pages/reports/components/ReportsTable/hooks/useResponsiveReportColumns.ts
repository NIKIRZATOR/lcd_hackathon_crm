import type { TableColumnsType } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ReportColumnDefinition, ReportColumnKey, ReportTableItem } from '../types';

export const EXPAND_COLUMN_WIDTH = 44;

const getVisibleColumns = <T extends ReportTableItem>(
  definitions: ReportColumnDefinition<T>[],
  containerWidth: number,
  reservedWidth: number,
) => {
  if (!containerWidth) {
    return {
      visible: definitions,
      hidden: [],
    };
  }

  const columnsMinWidth = definitions.reduce((sum, column) => sum + column.minWidth, 0);

  const totalMinWidth = columnsMinWidth + reservedWidth;

  if (totalMinWidth <= containerWidth) {
    return {
      visible: definitions,
      hidden: [],
    };
  }

  const availableWidth = Math.max(containerWidth - reservedWidth - EXPAND_COLUMN_WIDTH, 0);

  let currentWidth = 0;
  let visibleCount = 0;

  for (const column of definitions) {
    if (currentWidth + column.minWidth > availableWidth) {
      break;
    }

    currentWidth += column.minWidth;
    visibleCount += 1;
  }

  if (visibleCount === 0 && definitions.length) {
    visibleCount = 1;
  }

  return {
    visible: definitions.slice(0, visibleCount),
    hidden: definitions.slice(visibleCount),
  };
};

export const useResponsiveReportColumns = <T extends ReportTableItem>(
  selectedColumnKeys: ReportColumnKey<T>[],
  definitions: ReportColumnDefinition<T>[],
  reservedWidth = 0,
) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const element = tableContainerRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const selectedDefinitions = useMemo(
    () => definitions.filter((column) => selectedColumnKeys.includes(column.key)),
    [definitions, selectedColumnKeys],
  );

  const { visible, hidden } = useMemo(
    () => getVisibleColumns(selectedDefinitions, containerWidth, reservedWidth),
    [selectedDefinitions, containerWidth, reservedWidth],
  );

  const columns = useMemo<TableColumnsType<T>>(
    () =>
      visible.map((column) => ({
        key: column.key,
        dataIndex: column.key,
        title: column.title,
        minWidth: column.minWidth,
        sorter: column.sorter,
        render: column.render ? (_value, item) => column.render?.(item) : undefined,
      })),
    [visible],
  );

  return {
    tableContainerRef,
    columns,
    hiddenDefinitions: hidden,
  };
};

