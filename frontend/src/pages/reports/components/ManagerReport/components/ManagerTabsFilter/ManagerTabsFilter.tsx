import { Tabs } from 'antd';

export type ManagerTabOption = {
  id: string;
  name: string;
};

type ManagerTabsFilterProps = {
  managers: ManagerTabOption[];
  value: string | null;
  onChange: (managerId: string | null) => void;
};

const ManagerTabsFilter = ({ managers, value, onChange }: ManagerTabsFilterProps) => {
  const items = [
    {
      key: 'all',
      label: 'Все',
    },
    ...managers.map((manager) => ({
      key: manager.id,
      label: manager.name,
    })),
  ];

  const handleChange = (key: string) => {
    onChange(key === 'all' ? null : key);
  };

  return <Tabs activeKey={value ?? 'all'} items={items} onChange={handleChange} />;
};

export default ManagerTabsFilter;
