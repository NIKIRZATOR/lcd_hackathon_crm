import { Tag } from 'antd';
import { useMemo } from 'react';

import type {
  ManagerOverdueTaskItem,
  ManagerProgramHealth,
  ManagerTaskItem,
  ManagerReportItem,
} from '../../types';

import styles from './ManagerDetailsPopoverContent.module.scss';

type ManagerDetailsPopoverContentProps = {
  item: ManagerReportItem;
};

const HEALTH_CONFIG: Record<
  ManagerProgramHealth,
  {
    color: 'success' | 'warning' | 'error';
  }
> = {
  green: {
    color: 'success',
  },
  yellow: {
    color: 'warning',
  },
  red: {
    color: 'error',
  },
};

const getProgramKey = (university: string, program: string) => `${university}::${program}`;

const ManagerDetailsPopoverContent = ({ item }: ManagerDetailsPopoverContentProps) => {
  const attentionTasksByProgram = useMemo(() => {
    const map = new Map<string, ManagerTaskItem[]>();

    item.attentionTaskItems.forEach((task) => {
      const key = getProgramKey(task.university, task.program);
      const tasks = map.get(key) ?? [];

      tasks.push(task);
      map.set(key, tasks);
    });

    return map;
  }, [item.attentionTaskItems]);

  const overdueTasksByProgram = useMemo(() => {
    const map = new Map<string, ManagerOverdueTaskItem[]>();

    item.overdueTaskItems.forEach((task) => {
      const key = getProgramKey(task.university, task.program);
      const tasks = map.get(key) ?? [];

      tasks.push(task);
      map.set(key, tasks);
    });

    return map;
  }, [item.overdueTaskItems]);

  return (
    <div className={styles.content}>
      <div className={styles.header}>
        <div className={styles.manager}>{item.kam}</div>
        <div className={styles.role}>KAM</div>
      </div>

      <div className={styles.details}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Активные программы</span>

            <span className={styles.sectionCount}>{item.programItems.length}</span>
          </div>

          <div className={styles.items}>
            {item.programItems.map((program) => {
              const programKey = getProgramKey(program.university, program.name);

              const attentionTasks = attentionTasksByProgram.get(programKey) ?? [];
              const overdueTasks = overdueTasksByProgram.get(programKey) ?? [];

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

                    <Tag color={health.color} className={styles.statusTag}>
                      Health
                    </Tag>
                  </div>

                  {overdueTasks.length > 0 && (
                    <div className={styles.tasks}>
                      {overdueTasks.map((task) => (
                        <div key={task.id} className={styles.task}>
                          <div className={styles.taskHeader}>
                            <Tag color="error" className={styles.statusTag}>
                              Просрочено: {task.overdueDays} дн.
                            </Tag>
                          </div>

                          <div className={styles.taskReason}>{task.reason}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {attentionTasks.length > 0 && (
                    <div className={styles.tasks}>
                      {attentionTasks.map((task) => (
                        <div key={task.id} className={styles.task}>
                          <div className={styles.taskHeader}>
                            <Tag color="warning" className={styles.statusTag}>
                              Требует внимания
                            </Tag>
                          </div>

                          <div className={styles.taskReason}>{task.reason}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ManagerDetailsPopoverContent;
