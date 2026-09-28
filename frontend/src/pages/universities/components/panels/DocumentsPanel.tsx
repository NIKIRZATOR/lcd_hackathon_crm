import { SearchOutlined } from '@ant-design/icons';
import { Input, Select, Table } from 'antd';
import { useState } from 'react';

import type { DocumentStatus, SectionDocument, UniversitySections } from '../../domain/sectionData';
import { isInPeriod, usePeriod } from '../../domain/period';
import { byText, shownColumns, styles, unique, useCompact } from './panelShared';
import { Details, Pill } from './panelUi';

const documentLabel: Record<DocumentStatus, string> = {
  signed: 'Подписан', pending: 'На подписании', actual: 'Актуален', review: 'На согласовании', draft: 'Черновик',
};
const documentClass: Record<DocumentStatus, string> = {
  signed: styles.green, pending: styles.yellow, actual: styles.green, review: styles.blue, draft: styles.yellow,
};

export const DocumentsPanel = ({ sections }: { sections: UniversitySections }) => {
  const compact = useCompact();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState<DocumentStatus | ''>('');
  const [interaction, setInteraction] = useState('');
  const period = usePeriod();
  const filtered = sections.documents.filter((document) => (
    isInPeriod(document.at, period)
    && (!query || document.name.toLowerCase().includes(query.trim().toLowerCase()))
    && (!type || document.type === type)
    && (!status || document.status === status)
    && (!interaction || document.interaction === interaction)
  ));
  const columns = shownColumns<SectionDocument>(compact, [
    { title: 'Документ', dataIndex: 'name', key: 'name', sorter: byText((row: SectionDocument) => row.name) },
    { title: 'Связано с', dataIndex: 'linked', key: 'linked', wideOnly: true, sorter: byText((row: SectionDocument) => row.linked) },
    { title: 'Версия', dataIndex: 'version', key: 'version', width: 90, wideOnly: true, sorter: byText((row: SectionDocument) => row.version) },
    { title: 'Статус', key: 'status', sorter: byText((row: SectionDocument) => documentLabel[row.status]), render: (_v, row) => <Pill className={documentClass[row.status]}>{documentLabel[row.status]}</Pill> },
    { title: 'Обновлён', dataIndex: 'updated', key: 'updated', width: 120, wideOnly: true, sorter: byText((row: SectionDocument) => row.updated) },
    { title: 'Ответственный', dataIndex: 'owner', key: 'owner', wideOnly: true, sorter: byText((row: SectionDocument) => row.owner) },
  ]);

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <h2>Документы</h2>
        <div className={styles.filters}>
          <Input className={styles.search} allowClear prefix={<SearchOutlined />} placeholder="Поиск по названию..." value={query} onChange={(event) => setQuery(event.target.value)} />
          <Select className={styles.filter} allowClear placeholder="Все типы" value={type || undefined} options={unique(sections.documents.map((document) => document.type)).map((value) => ({ value, label: value }))} onChange={(value) => setType(value ?? '')} />
          <Select className={styles.filter} allowClear placeholder="Все статусы" value={status || undefined} options={(Object.keys(documentLabel) as DocumentStatus[]).map((value) => ({ value, label: documentLabel[value] }))} onChange={(value) => setStatus(value ?? '')} />
          <Select className={styles.filter} allowClear placeholder="Все взаимодействия" value={interaction || undefined} options={unique(sections.documents.map((document) => document.interaction)).map((value) => ({ value, label: value }))} onChange={(value) => setInteraction(value ?? '')} />
        </div>
      </div>
      <div className={styles.card}>
        <Table<SectionDocument>
          rowKey="id"
          size="middle"
          pagination={false}
          dataSource={filtered}
          locale={{ emptyText: 'Документы не найдены' }}
          columns={columns}
          expandable={compact ? { expandedRowRender: (row) => <Details rows={[['Связано с', row.linked], ['Версия', row.version], ['Обновлён', row.updated], ['Ответственный', row.owner]]} /> } : undefined}
        />
      </div>
      <div className={styles.split}>
        <div className={styles.block}>
          <h3>Документы, требующие внимания</h3>
          {sections.docAlerts.map((alert) => (
            <div key={alert.title} className={styles.alert}>
              <span><strong>{alert.days}</strong> {alert.title}</span>
              <Pill className={alert.level === 'soon' ? styles.yellow : styles.red}>{alert.level === 'soon' ? 'Скоро' : 'Важно'}</Pill>
            </div>
          ))}
        </div>
        <div className={styles.block}>
          <h3>Последние версии</h3>
          <p className={styles.note}>При открытии документа пользователь видит карточку документа, историю версий и доступные действия: просмотр, скачивание и загрузку новой версии в рамках своих прав.</p>
        </div>
      </div>
    </div>
  );
};
