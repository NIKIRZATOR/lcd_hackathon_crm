import { Badge } from 'antd';

import type { ProgramImplementationStatus, ProgramReportItem } from '../../../../types';

import styles from './ProgramDetailsPopoverContent.module.scss';

type ProgramDetailsPopoverContentProps = {
  item: ProgramReportItem;
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
      </div>

      <div className={styles.divider} />

      <div className={styles.universities}>
        {item.universityItems.map((universityItem) => {
          const status = IMPLEMENTATION_STATUS_CONFIG[universityItem.implementationStatus];

          return (
            <div key={universityItem.university.id} className={styles.university}>
              <div className={styles.universityHeader}>
                <div>
                  <div className={styles.universityName}>{universityItem.university.name}</div>

                  <div className={styles.responsible}>{universityItem.responsible.name}</div>
                </div>

                <Badge status={status.badgeStatus} text={status.label} />
              </div>

              <div className={styles.metrics}>
                <span>
                  Заявки <strong>{universityItem.applications}</strong>
                </span>

                <span>
                  Обучающиеся <strong>{universityItem.students}</strong>
                </span>

                <span>
                  Потоки <strong>{universityItem.streams}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgramDetailsPopoverContent;
