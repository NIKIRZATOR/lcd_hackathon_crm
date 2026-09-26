import { Tag } from 'antd';
import type { ReactNode } from 'react';

import { styles } from './panelShared';

export const Pill = ({ className, children }: { className: string; children: ReactNode }) => (
  <Tag className={`${styles.pill} ${className}`}>{children}</Tag>
);

export const Details = ({ rows }: { rows: Array<[string, ReactNode]> }) => (
  <div className={styles.details}>
    {rows.map(([label, value]) => (
      <div key={label}><span>{label}</span><strong>{value}</strong></div>
    ))}
  </div>
);

