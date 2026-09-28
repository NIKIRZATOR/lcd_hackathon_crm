import { DownOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Checkbox, Flex, Popover } from 'antd';
import { useState, useTransition } from 'react';

import type { ReportColumnDefinition, ReportColumnKey, ReportTableItem } from '../types';

type ReportColumnsSelectorProps<T extends ReportTableItem> = {
  value: ReportColumnKey<T>[];
  definitions: ReportColumnDefinition<T>[];
  defaultValue: ReportColumnKey<T>[];
  onChange: (value: ReportColumnKey<T>[]) => void;
};

const ReportColumnsSelector = <T extends ReportTableItem>({
  value,
  definitions,
  defaultValue,
  onChange,
}: ReportColumnsSelectorProps<T>) => {
  const [open, setOpen] = useState(false);

  const [draftValue, setDraftValue] = useState<ReportColumnKey<T>[]>(value);

  const [, startTransition] = useTransition();

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (nextOpen) {
      setDraftValue(value);
    }
  };

  const handleApply = () => {
    setOpen(false);

    startTransition(() => {
      onChange(draftValue);
    });
  };

  const handleReset = () => {
    setDraftValue(defaultValue);
  };

  const content = (
    <Flex vertical gap={16} style={{ width: 300 }}>
      <Checkbox.Group
        value={draftValue}
        onChange={(values) => {
          setDraftValue(values as ReportColumnKey<T>[]);
        }}
      >
        <Flex vertical gap={10}>
          {definitions.map((column) => (
            <Checkbox key={column.key} value={column.key}>
              {column.title}
            </Checkbox>
          ))}
        </Flex>
      </Checkbox.Group>

      <Flex justify="space-between" align="center">
        <Button type="link" onClick={handleReset}>
          Сбросить по умолчанию
        </Button>

        <Button type="primary" disabled={!draftValue.length} onClick={handleApply}>
          Применить
        </Button>
      </Flex>
    </Flex>
  );

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      autoAdjustOverflow={false}
      content={content}
      open={open}
      onOpenChange={handleOpenChange}
    >
      <Button icon={<SettingOutlined />}>
        Колонки ({value.length}/{definitions.length})
        <DownOutlined />
      </Button>
    </Popover>
  );
};

export default ReportColumnsSelector;
