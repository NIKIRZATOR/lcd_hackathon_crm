import { Badge } from 'antd';

import type { ManagerReportItem } from '../../types';

import styles from './ManagerDetailsPopoverContent.module.scss';

type ManagerDetailsPopoverContentProps = {
  item: ManagerReportItem;
};

const ManagerDetailsPopoverContent = ({ item }: ManagerDetailsPopoverContentProps) => {
  return (
    <div className={styles.content}>
      <div className={styles.header}>
        <div className={styles.manager}>{item.kam}</div>
        <div className={styles.role}>KAM</div>
      </div>

      <div className={styles.summary}>
        <div>
          <span>Программ</span>
          <strong>{item.programs}</strong>
        </div>

        <div>
          <span>Активных</span>
          <strong>{item.activeInteractions}</strong>
        </div>

        <div>
          <span>Завершённых</span>
          <strong>{item.completedInteractions}</strong>
        </div>

        <div>
          <span>Просроченных</span>
          <strong>{item.overdueInteractions}</strong>
        </div>

        <div>
          <span>Требуют внимания</span>
          <strong>{item.attentionRequired}</strong>
        </div>

        <div>
          <span>Среднее время этапа</span>
          <strong>{item.averageStageDuration} дн.</strong>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.details}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Программы</span>
            <span className={styles.sectionCount}>{item.programItems.length}</span>
          </div>

          <div className={styles.items}>
            {item.programItems.map((program) => (
              <div key={program.id} className={styles.item}>
                <div className={styles.itemTitle}>{program.name}</div>
                <div className={styles.itemDescription}>{program.product}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Активные взаимодействия</span>

            <span className={styles.sectionCount}>{item.activeInteractionItems.length}</span>
          </div>

          <div className={styles.items}>
            {item.activeInteractionItems.map((interaction) => (
              <div key={interaction.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <div>
                    <div className={styles.itemTitle}>{interaction.university}</div>

                    <div className={styles.itemDescription}>{interaction.program}</div>
                  </div>

                  <Badge status="processing" text={interaction.stage} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Завершённые взаимодействия</span>

            <span className={styles.sectionCount}>{item.completedInteractionItems.length}</span>
          </div>

          <div className={styles.items}>
            {item.completedInteractionItems.map((interaction) => (
              <div key={interaction.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <div>
                    <div className={styles.itemTitle}>{interaction.university}</div>

                    <div className={styles.itemDescription}>{interaction.program}</div>
                  </div>

                  <Badge status="success" text="Завершено" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Просроченные этапы</span>

            <span className={styles.sectionCount}>{item.overdueItems.length}</span>
          </div>

          <div className={styles.items}>
            {item.overdueItems.map((overdueItem) => (
              <div key={overdueItem.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <div>
                    <div className={styles.itemTitle}>{overdueItem.university}</div>

                    <div className={styles.itemDescription}>{overdueItem.program}</div>
                  </div>

                  <Badge status="error" text={`${overdueItem.overdueDays} дн.`} />
                </div>

                <div className={styles.meta}>
                  Этап: <strong>{overdueItem.stage}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Требуют внимания</span>

            <span className={styles.sectionCount}>{item.attentionItems.length}</span>
          </div>

          <div className={styles.items}>
            {item.attentionItems.map((attentionItem) => (
              <div key={attentionItem.id} className={styles.item}>
                <div className={styles.itemTitle}>{attentionItem.university}</div>

                <div className={styles.itemDescription}>{attentionItem.program}</div>

                <div className={styles.meta}>
                  Причина: <strong>{attentionItem.reason}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ManagerDetailsPopoverContent;

