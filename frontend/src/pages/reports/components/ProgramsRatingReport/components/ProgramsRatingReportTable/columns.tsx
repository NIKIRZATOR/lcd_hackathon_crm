import { Progress } from 'antd';

import type { ReportColumnDefinition, ReportColumnKey } from '../../../ReportsTable/types';

import type { ProgramRatingReportItem } from '../../types';

import styles from './ProgramsRatingReportTable.module.scss';

export const PROGRAM_RATING_REPORT_COLUMN_DEFINITIONS: ReportColumnDefinition<ProgramRatingReportItem>[] =
  [
    {
      key: 'program',
      title: 'Программа',
      minWidth: 160,
      sorter: (a, b) => a.program.localeCompare(b.program, 'ru'),
    },
    {
      key: 'product',
      title: 'ИТ-продукт',
      minWidth: 160,
      sorter: (a, b) => a.product.localeCompare(b.product, 'ru'),
    },
    {
      key: 'universities',
      title: 'Вузы',
      minWidth: 80,
      sorter: (a, b) => a.universities - b.universities,
    },
    {
      key: 'implementedUniversities',
      title: 'В эксплуатации',
      minWidth: 160,
      sorter: (a, b) => a.implementedUniversities - b.implementedUniversities,
      render: (item) => (
        <div className={styles.implementation}>
          <Progress
            percent={item.implementationShare}
            showInfo={false}
            size="small"
            className={styles.progress}
          />

          <span className={styles.implementationValue}>
            {item.implementedUniversities} из {item.universities}
          </span>
        </div>
      ),
    },
    {
      key: 'implementationShare',
      title: 'Доля внедрения',
      minWidth: 130,
      sorter: (a, b) => a.implementationShare - b.implementationShare,
      render: (item) => `${item.implementationShare}%`,
    },
    {
      key: 'applications',
      title: 'Заявки',
      minWidth: 90,
      sorter: (a, b) => a.applications - b.applications,
    },
    {
      key: 'students',
      title: 'Студенты',
      minWidth: 120,
      sorter: (a, b) => a.students - b.students,
    },
    {
      key: 'streams',
      title: 'Потоки',
      minWidth: 80,
      sorter: (a, b) => a.streams - b.streams,
    },
    {
      key: 'rating',
      title: 'Индекс востребованности',
      minWidth: 160,
      sorter: (a, b) => a.rating - b.rating,
    },
  ];

export const PROGRAM_RATING_REPORT_DEFAULT_COLUMN_KEYS: ReportColumnKey<ProgramRatingReportItem>[] =
  [
    'program',
    'product',
    'universities',
    'implementedUniversities',
    'implementationShare',
    'applications',
    'students',
    'streams',
    'rating',
  ];
