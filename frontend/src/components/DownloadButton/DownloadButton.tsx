import { DownOutlined } from '@ant-design/icons';
import { Button, Dropdown, Space } from 'antd';
import type { DropdownProps, MenuProps } from 'antd';
import type { ReactNode } from 'react';

type DownloadOption<T extends string> = {
  key: T;
  label: ReactNode;
};

type DownloadButtonProps<T extends string> = {
  defaultFormat: T;
  options: DownloadOption<T>[];
  onDownload: (format: T) => void;
  trigger?: DropdownProps['trigger'];
};

const DownloadButton = <T extends string>({
  defaultFormat,
  options,
  onDownload,
  trigger = ['click'],
}: DownloadButtonProps<T>) => {
  const items: MenuProps['items'] = options.map(({ key, label }) => ({
    key,
    label,
  }));

  const defaultOption = options.find(({ key }) => key === defaultFormat);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    onDownload(key as T);
  };

  return (
    <Space.Compact>
      <Button onClick={() => onDownload(defaultFormat)}>{defaultOption?.label}</Button>

      <Dropdown
        trigger={trigger}
        menu={{
          items,
          onClick: handleMenuClick,
        }}
      >
        <Button icon={<DownOutlined />} />
      </Dropdown>
    </Space.Compact>
  );
};

export default DownloadButton;
