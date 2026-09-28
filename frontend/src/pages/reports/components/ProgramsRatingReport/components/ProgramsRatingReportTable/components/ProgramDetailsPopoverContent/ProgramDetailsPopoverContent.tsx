import { Badge } from 'antd';

import type { ProgramImplementationStatus, ProgramRatingReportItem } from '../../../../types';

import styles from './ProgramDetailsPopoverContent.module.scss';

type ProgramDetailsPopoverContentProps = {
  item: ProgramRatingReportItem;
};

const IMPLEMENTATION_STATUS_CONFIG: Record<
  ProgramImplementationStatus,
  {
    label: string;
    badgeStatus: 'success' | 'processing';
  }
> = {
  implemented: {
    label: 'В эксплуатации',
    badgeStatus: 'success',
  },
  inProgress: {
    label: 'Идёт внедрение',
    badgeStatus: 'processing',
  },
};

const ProgramDetailsPopoverContent = ({ item }: ProgramDetailsPopoverContentProps) => {
  return (
    <div className={styles.content}>
      <div className={styles.header}>
        <div className={styles.program}>{item.program}</div>
        <div className={styles.product}>{item.product}</div>
      </div>

      <div className={styles.summary}>
        <div>
          <span>Вузов</span>
          <strong>{item.universities}</strong>
        </div>

        <div>
          <span>В эксплуатации</span>
          <strong>
            {item.implementedUniversities} из {item.universities}
          </strong>
        </div>

        <div>
          <span>Доля внедрения</span>
          <strong>{item.implementationShare}%</strong>
        </div>

        <div>
          <span>Индекс востребованности</span>
          <strong>{item.rating}</strong>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.universities}>
        {item.universityItems.map((universityItem, index) => {
          const status = IMPLEMENTATION_STATUS_CONFIG[universityItem.implementationStatus];

          return (
            <div key={`${universityItem.university.id}-${index}`} className={styles.university}>
              <div className={styles.universityHeader}>
                <div className={styles.universityMain}>
                  <div className={styles.universityName}>{universityItem.university.name}</div>

                  <div className={styles.responsible}>{universityItem.responsible.name}</div>
                </div>

                <div className={styles.implementationStatus}>
                  <Badge
                    status={status.badgeStatus}
                    text={status.label}
                    className={styles.statusBadge}
                  />
                </div>
              </div>

              <div className={styles.metrics}>
                <div className={styles.metric}>
                  <span>Заявки</span>
                  <strong>{universityItem.applications}</strong>
                </div>

                <div className={styles.metric}>
                  <span>Обучающиеся</span>
                  <strong>{universityItem.students}</strong>
                </div>

                <div className={styles.metric}>
                  <span>Потоки</span>
                  <strong>{universityItem.streams}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgramDetailsPopoverContent;
