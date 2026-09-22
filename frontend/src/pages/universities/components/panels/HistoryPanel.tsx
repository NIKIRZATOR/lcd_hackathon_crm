import { Empty, Select } from 'antd';
import { useState } from 'react';

import type { SectionHistory, UniversitySections } from '../../sectionData';
import { isInPeriod, usePeriod } from '../../period';
import { styles, unique } from './panelShared';

export const HistoryPanel = ({ sections }: { sections: UniversitySections }) => {
  const [area, setArea] = useState<SectionHistory['area'] | ''>('');
  const [interaction, setInteraction] = useState('');
  const [actor, setActor] = useState('');
  const period = usePeriod();
  const filtered = sections.history.filter((event) => isInPeriod(event.at, period) && (!area || event.area === area) && (!interaction || event.interaction === interaction) && (!actor || event.actor === actor));

  return (
    <div className={styles.section}>
      <div className={styles.head}>
        <h2>История вуза</h2>
        <div className={styles.filters}>
          <Select className={styles.filter} allowClear placeholder="Все взаимодействия" value={interaction || undefined} options={unique(sections.history.map((event) => event.interaction)).map((value) => ({ value, label: value }))} onChange={(value) => setInteraction(value ?? '')} />
          <Select className={styles.filter} allowClear placeholder="Все пользователи" value={actor || undefined} options={unique(sections.history.map((event) => event.actor)).map((value) => ({ value, label: value }))} onChange={(value) => setActor(value ?? '')} />
        </div>
      </div>
      <div className={styles.split}>
        <div className={styles.block}>
          <h3>Последние события</h3>
          {filtered.length === 0 ? <Empty description="Событий нет" /> : (
            <ul className={styles.timeline}>
              {filtered.map((event) => (
                <li key={event.id}>
                  <div>
                    <small>{event.when}</small>
                    <strong>{event.title}</strong>
                    <p>{event.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.block}>
          <h3>О журнале</h3>
          <p className={styles.note}>Здесь агрегируются значимые события по университету: изменения ответственных, документы, события LMS, создание взаимодействий, задачи и другие действия. Детальная история конкретного взаимодействия остаётся внутри его карточки.</p>
          <h3>Фильтры аудита</h3>
          <div className={styles.chips}>
            {([['', 'Все'], ['users', 'Пользователи'], ['integrations', 'Интеграции'], ['documents', 'Документы']] as const).map(([value, label]) => (
              <button key={label} type="button" className={area === value ? styles.chipActive : styles.chip} onClick={() => setArea(value)}>{label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
