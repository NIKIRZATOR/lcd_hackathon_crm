import { Tabs } from 'antd';

export type ManagerTabOption = {
  id: number;
  name: string;
};

type ManagerTabsFilterProps = {
  managers: ManagerTabOption[];
  value: number | null;
  onChange: (managerId: number | null) => void;
};

const ManagerTabsFilter = ({ managers, value, onChange }: ManagerTabsFilterProps) => {
  const items = [
    {
      key: 'all',
      label: 'Все',
    },
    ...managers.map((manager) => ({
      key: String(manager.id),
      label: manager.name,
    })),
  ];

  const handleChange = (key: string) => {
    onChange(key === 'all' ? null : Number(key));
  };

  return (
    <Tabs
      activeKey={value === null ? 'all' : String(value)}
      items={items}
      onChange={handleChange}
    />
  );
};

export default ManagerTabsFilter;

