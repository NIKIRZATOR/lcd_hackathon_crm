import { SearchOutlined } from '@ant-design/icons';
import { Input, Select, Table } from 'antd';
import { useState } from 'react';

import type { Readiness, SectionTeacher, TrainingStatus, UniversitySections } from '../../sectionData';
import { readinessSlices } from '../../sectionData';
import { byText, shownColumns, styles, unique, useCompact } from './panelShared';
import { Details, Pill } from './panelUi';

const trainingLabel: Record<TrainingStatus, string> = { done: 'Завершено', progress: 'В процессе', notStarted: 'Не начато' };
const trainingClass: Record<TrainingStatus, string> = { done: styles.green, progress: styles.blue, notStarted: styles.red };

export const TeachersPanel = ({ sections }: { sections: UniversitySections }) => {
  const compact = useCompact();
  const [query, setQuery] = useState('');
  const [program, setProgram] = useState('');
  const [training, setTraining] = useState<TrainingStatus | ''>('');
  const [readiness, setReadiness] = useState<Readiness | ''>('');
  const filtered = sections.teachers.filter((teacher) => (
    (!query || teacher.name.toLowerCase().includes(query.trim().toLowerCase()))
    && (!program || teacher.program === program)
    && (!training || teacher.training === training)
    && (!readiness || teacher.readiness === readiness)
  ));
  const columns = shownColumns<SectionTeacher>(compact, [
    { title: 'ФИО', dataIndex: 'name', key: 'name', sorter: byText((row: SectionTeacher) => row.name) },
    { title: 'Кафедра', dataIndex: 'department', key: 'department', wideOnly: true, sorter: byText((row: SectionTeacher) => row.department) },
    { title: 'Программа', dataIndex: 'program', key: 'program', wideOnly: true, sorter: byText((row: SectionTeacher) => row.program) },
    { title: compact ? 'Обучение' : 'Статус обучения', key: 'training', sorter: byText((row: SectionTeacher) => trainingLabel[row.training]), render: (_v, row) => <Pill className={trainingClass[row.training]}>{trainingLabel[row.training]}</Pill> },
    { title: 'Квалификация', dataIndex: 'qualification', key: 'qualification', wideOnly: true, sorter: byText((row: SectionTeacher) => row.qualification) },
  ]);

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <h2>Преподаватели</h2>
        <div className={styles.filters}>
          <Input className={styles.search} allowClear prefix={<SearchOutlined />} placeholder="Поиск преподавателя..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <Select className={styles.filter} allowClear placeholder="Все программы" value={program || undefined} options={unique(sections.teachers.map((teacher) => teacher.program)).map((value) => ({ value, label: value }))} onChange={(value) => setProgram(value ?? '')} />
          <Select className={styles.filter} allowClear placeholder="Статус обучения" value={training || undefined} options={(Object.keys(trainingLabel) as TrainingStatus[]).map((value) => ({ value, label: trainingLabel[value] }))} onChange={(value) => setTraining(value ?? '')} />
        </div>
      </div>
      {sections.teachers.length > 0 && <div className={styles.bars} aria-label="Готовность преподавателей">
        {readinessSlices.map((slice) => (
          <button
            key={slice.key}
            type="button"
            className={readiness === slice.key ? styles.barActive : styles.bar}
            aria-pressed={readiness === slice.key}
            onClick={() => setReadiness(readiness === slice.key ? '' : slice.key)}
          >
            <span className={styles.barLabel}>{slice.label}</span>
            <span className={styles.barTrack}>
              <span style={{ width: `${slice.percent}%`, background: slice.color }} />
            </span>
            <span className={styles.barValue}>{slice.percent}%</span>
          </button>
        ))}
      </div>}
      <div className={styles.card}>
        <Table<SectionTeacher>
          rowKey="id"
          size="middle"
          pagination={false}
          dataSource={filtered}
          locale={{ emptyText: 'Преподаватели не найдены' }}
          columns={columns}
          expandable={compact ? { expandedRowRender: (row) => <Details rows={[['Кафедра', row.department], ['Программа', row.program], ['Квалификация', row.qualification]]} /> } : undefined}
        />
      </div>
    </div>
  );
};
