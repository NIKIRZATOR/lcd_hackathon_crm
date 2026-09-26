import { RightOutlined } from '@ant-design/icons';
import { Button, Card, Tag } from 'antd';

import type { CardInteraction, TaskPriority, UniversityCard } from '../universityCard';
import UniversityInteractionTable from './UniversityInteractionTable';

import styles from './UniversityOverview.module.scss';

type UniversityTab = 'interactions' | 'tasks';

type UniversityOverviewProps = {
  card: UniversityCard;
  interactions: CardInteraction[];
  programs: number;
  streams: number;
  onOpenTab: (tab: UniversityTab) => void;
  onOpenInteraction?: (id: string) => void;
};

const numberFormat = new Intl.NumberFormat('ru-RU');

const plural = (value: number, one: string, few: string, many: string) => {
  const mod100 = Math.abs(value) % 100;
  const mod10 = mod100 % 10;
  if (mod100 > 10 && mod100 < 20) return many;
  if (mod10 > 1 && mod10 < 5) return few;
  if (mod10 === 1) return one;
  return many;
};

const priorityLabel: Record<TaskPriority, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

const priorityClassName: Record<TaskPriority, string> = {
  high: styles.priorityHigh,
  medium: styles.priorityMedium,
  low: styles.priorityLow,
};

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const UniversityOverview = ({ card, interactions, programs, streams, onOpenTab, onOpenInteraction }: UniversityOverviewProps) => {
  const stats = [
    [interactions.length, plural(interactions.length, 'взаимодействие', 'взаимодействия', 'взаимодействий')],
    [programs, plural(programs, 'программа', 'программы', 'программ')],
    [card.products, plural(card.products, 'ИТ-продукт', 'ИТ-продукта', 'ИТ-продуктов')],
    [card.teachers, plural(card.teachers, 'преподаватель', 'преподавателя', 'преподавателей')],
    [streams, plural(streams, 'поток', 'потока', 'потоков')],
    [numberFormat.format(card.students), 'обучающихся'],
  ];

  return (
    <div className={styles.overview}>
      <section className={styles.metrics} aria-label="Сводка по вузу">
        {stats.map(([value, label]) => (
          <div key={label} className={styles.metric}>
            <strong>{typeof value === 'number' && value < 0 ? '—' : value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>
      <div className={styles.top}>
        <Card
          className={styles.panel}
          title="Текущие взаимодействия"
          extra={<Button type="link" className={styles.linkButton} onClick={() => onOpenTab('interactions')}>Все взаимодействия <RightOutlined /></Button>}
        >
          <UniversityInteractionTable rows={interactions} preview onOpen={onOpenInteraction} />
        </Card>

        <Card
          className={`${styles.panel} ${styles.attention}`}
          title="Требует внимания"
          extra={<Button type="link" className={styles.linkButton} onClick={() => onOpenTab('tasks')}>Смотреть все <RightOutlined /></Button>}
        >
          <ul className={styles.attentionList}>
            {card.attention.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className={styles.bottom}>
        <Card
          className={styles.panel}
          title="Контакты и ответственные"
        >
          <ul className={styles.people}>
            {card.contacts.map((contact) => (
              <li key={contact.email} className={styles.person}>
                <span className={styles.avatar}>{initials(contact.name)}</span>
                <span>
                  <strong>{contact.name}</strong>
                  <span>{contact.role}</span>
                </span>
                <span className={styles.personContacts}>
                  <span>{contact.phone}</span>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          className={styles.panel}
          title="Ближайшие задачи и встречи"
          extra={<Button type="link" className={styles.linkButton} onClick={() => onOpenTab('tasks')}>Все задачи <RightOutlined /></Button>}
        >
          <ul className={styles.tasks}>
            {card.tasks.map((task) => (
              <li key={`${task.date}-${task.title}`}>
                <span className={styles.taskDate}>{task.date}</span>
                <span>
                  <strong>{task.title}</strong>
                  <span>{task.kind}</span>
                </span>
                <Tag className={`${styles.priority} ${priorityClassName[task.priority]}`}>{priorityLabel[task.priority]}</Tag>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default UniversityOverview;
