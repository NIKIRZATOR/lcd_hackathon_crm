import { SearchOutlined } from '@ant-design/icons';
import { Input, Select, Table } from 'antd';
import { useState } from 'react';

import type { SectionTask, TaskKind, UniversitySections } from '../../sectionData';
import { isInPeriod, usePeriod } from '../../period';
import { byText, shownColumns, styles, unique, useCompact } from './panelShared';
import { Details, Pill } from './panelUi';

const kindLabel: Record<TaskKind, string> = { task: 'Задача', meeting: 'Встреча', communication: 'Коммуникация' };
const priorityLabel = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
const priorityClass = { high: styles.red, medium: styles.yellow, low: styles.green };
const taskStateLabel = { inProgress: 'В работе', planned: 'Запланирована' };
const taskStateClass = { inProgress: styles.yellow, planned: styles.blue };

export const TasksPanel = ({ sections }: { sections: UniversitySections }) => {
  const compact = useCompact();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<TaskKind | ''>('');
  const [status, setStatus] = useState<SectionTask['status'] | ''>('');
  const [owner, setOwner] = useState('');
  const period = usePeriod();
  const filtered = sections.tasks.filter((task) => {
    const haystack = `${task.title} ${task.linked}`.toLowerCase();
    return isInPeriod(task.at, period)
      && (!query || haystack.includes(query.trim().toLowerCase()))
      && (!kind || task.kind === kind)
      && (!status || task.status === status)
      && (!owner || task.owner === owner);
  });
  const columns = shownColumns<SectionTask>(compact, [
    { title: 'Название', dataIndex: 'title', key: 'title', sorter: byText((row: SectionTask) => row.title) },
    { title: 'Тип', key: 'kind', wideOnly: true, sorter: byText((row: SectionTask) => kindLabel[row.kind]), render: (_v, row) => kindLabel[row.kind] },
    { title: 'Связано с', dataIndex: 'linked', key: 'linked', wideOnly: true, sorter: byText((row: SectionTask) => row.linked) },
    { title: 'Срок', dataIndex: 'due', key: 'due', width: 110, wideOnly: true, sorter: byText((row: SectionTask) => row.due) },
    { title: 'Ответственный', dataIndex: 'owner', key: 'owner', wideOnly: true, sorter: byText((row: SectionTask) => row.owner) },
    { title: 'Приоритет', key: 'priority', sorter: byText((row: SectionTask) => priorityLabel[row.priority]), render: (_v, row) => <Pill className={priorityClass[row.priority]}>{priorityLabel[row.priority]}</Pill> },
    { title: 'Статус', key: 'status', wideOnly: true, sorter: byText((row: SectionTask) => taskStateLabel[row.status]), render: (_v, row) => <Pill className={taskStateClass[row.status]}>{taskStateLabel[row.status]}</Pill> },
  ]);

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <h2>Задачи и встречи</h2>
        <div className={styles.filters}>
          <Input className={styles.search} allowClear prefix={<SearchOutlined />} placeholder="Поиск по названию" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Select className={styles.filter} allowClear placeholder="Тип" value={kind || undefined} options={(Object.keys(kindLabel) as TaskKind[]).map((value) => ({ value, label: kindLabel[value] }))} onChange={(value) => setKind(value ?? '')} />
          <Select className={styles.filter} allowClear placeholder="Все статусы" value={status || undefined} options={(Object.keys(taskStateLabel) as SectionTask['status'][]).map((value) => ({ value, label: taskStateLabel[value] }))} onChange={(value) => setStatus(value ?? '')} />
          <Select className={styles.filter} allowClear placeholder="Ответственный" value={owner || undefined} options={unique(sections.tasks.map((task) => task.owner)).map((value) => ({ value, label: value }))} onChange={(value) => setOwner(value ?? '')} />
        </div>
      </div>
      <div className={styles.card}>
        <Table<SectionTask>
          rowKey="id"
          size="middle"
          pagination={false}
          dataSource={filtered}
          locale={{ emptyText: 'Задач не найдено' }}
          columns={columns}
          expandable={compact ? { expandedRowRender: (row) => <Details rows={[['Тип', kindLabel[row.kind]], ['Связано с', row.linked], ['Срок', row.due], ['Ответственный', row.owner], ['Статус', taskStateLabel[row.status]]]} /> } : undefined}
        />
      </div>
    </div>
  );
};
