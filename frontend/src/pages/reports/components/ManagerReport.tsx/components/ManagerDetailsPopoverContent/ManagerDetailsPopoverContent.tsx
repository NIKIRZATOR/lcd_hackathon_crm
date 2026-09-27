import { Badge } from 'antd';

import type { ManagerProgramHealth, ManagerReportItem } from '../../types';

import styles from './ManagerDetailsPopoverContent.module.scss';

type ManagerDetailsPopoverContentProps = {
  item: ManagerReportItem;
};

const HEALTH_CONFIG: Record<
  ManagerProgramHealth,
  {
    label: string;
    status: 'success' | 'warning' | 'error';
  }
> = {
  green: {
    label: 'В норме',
    status: 'success',
  },
  yellow: {
    label: 'Требует внимания',
    status: 'warning',
  },
  red: {
    label: 'Критично',
    status: 'error',
  },
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
          <span>Активные программы</span>
          <strong>{item.activePrograms}</strong>
        </div>

        <div>
          <span>Зелёный Health</span>
          <strong>{item.greenHealth}</strong>
        </div>

        <div>
          <span>Жёлтый Health</span>
          <strong>{item.yellowHealth}</strong>
        </div>

        <div>
          <span>Красный Health</span>
          <strong>{item.redHealth}</strong>
        </div>

        <div>
          <span>Просроченные задачи</span>
          <strong>{item.overdueTasks}</strong>
        </div>

        <div>
          <span>Требуют внимания</span>
          <strong>{item.attentionTasks}</strong>
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.details}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Активные программы</span>

            <span className={styles.sectionCount}>{item.programItems.length}</span>
          </div>

          <div className={styles.items}>
            {item.programItems.map((program) => {
              const health = HEALTH_CONFIG[program.health];

              return (
                <div key={program.id} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <div className={styles.itemContent}>
                      <div className={styles.itemTitle}>{program.name}</div>

                      <div className={styles.itemDescription}>{program.university}</div>

                      <div className={styles.meta}>
                        ИТ-продукт: <strong>{program.product}</strong>
                      </div>
                    </div>

                    <Badge status={health.status} text={health.label} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Просроченные задачи</span>

            <span className={styles.sectionCount}>{item.overdueTaskItems.length}</span>
          </div>

          {item.overdueTaskItems.length > 0 ? (
            <div className={styles.items}>
              {item.overdueTaskItems.map((task) => (
                <div key={task.id} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <div className={styles.itemContent}>
                      <div className={styles.itemTitle}>{task.university}</div>

                      <div className={styles.itemDescription}>{task.program}</div>
                    </div>

                    <Badge status="error" text={`${task.overdueDays} дн.`} />
                  </div>

                  <div className={styles.meta}>
                    Причина: <strong>{task.reason}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>Просроченных задач нет</div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Требуют внимания</span>

            <span className={styles.sectionCount}>{item.attentionTaskItems.length}</span>
          </div>

          {item.attentionTaskItems.length > 0 ? (
            <div className={styles.items}>
              {item.attentionTaskItems.map((task) => (
                <div key={task.id} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <div className={styles.itemContent}>
                      <div className={styles.itemTitle}>{task.university}</div>

                      <div className={styles.itemDescription}>{task.program}</div>
                    </div>

                    <Badge status="warning" text="Внимание" />
                  </div>

                  <div className={styles.meta}>
                    Причина: <strong>{task.reason}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>Задач, требующих внимания, нет</div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ManagerDetailsPopoverContent;
