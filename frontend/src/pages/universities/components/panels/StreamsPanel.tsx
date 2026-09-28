import { Select, Table } from 'antd';
import { useState } from 'react';

import type { UniversitySections } from '../../domain/sectionData';
import { byNumber, byText, styles, unique, workClass, workLabel } from './panelShared';
import { Pill } from './panelUi';

export const StreamsPanel = ({ sections }: { sections: UniversitySections }) => {
  const [program, setProgram] = useState('');
  const filtered = sections.streams.filter((stream) => !program || stream.program === program);

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <h2>Потоки</h2>
        <div className={styles.filters}>
          <Select className={styles.filter} allowClear placeholder="Все программы" value={program || undefined} options={unique(sections.streams.map((stream) => stream.program)).map((value) => ({ value, label: value }))} onChange={(value) => setProgram(value ?? '')} />
        </div>
      </div>
      <div className={styles.card}>
        <Table
          rowKey="id"
          size="middle"
          pagination={false}
          dataSource={filtered}
          locale={{ emptyText: 'Потоков пока нет' }}
          columns={[
            { title: 'Поток', dataIndex: 'name', key: 'name', sorter: byText((row) => row.name) },
            { title: 'Программа', dataIndex: 'program', key: 'program', sorter: byText((row) => row.program) },
            { title: 'Обучающиеся', dataIndex: 'students', key: 'students', sorter: byNumber((row) => row.students) },
            { title: 'Статус', key: 'status', sorter: byText((row) => workLabel[row.status]), render: (_v, row) => <Pill className={workClass[row.status]}>{workLabel[row.status]}</Pill> },
          ]}
        />
      </div>
    </div>
  );
};
