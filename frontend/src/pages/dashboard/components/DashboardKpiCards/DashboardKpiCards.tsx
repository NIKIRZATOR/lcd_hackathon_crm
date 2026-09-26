import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { Card } from 'antd';

import HorizontalScroll from '../../../../components/horizontalScroll/HorizontalScroll';

import { dashboardKpiMock } from './mocks';
import type { DashboardKpiItem } from './types';

import styles from './DashboardKpiCards.module.scss';

const numberFormatter = new Intl.NumberFormat('ru-RU');

type DashboardKpiCardsProps = {
  items?: DashboardKpiItem[];
};

const DashboardKpiCards = ({ items = dashboardKpiMock }: DashboardKpiCardsProps) => {
  return (
    <HorizontalScroll>
      {items.map((item) => {
        const isUp = item.trendDirection === 'up';
        const isPositive = item.trendStatus === 'positive';

        return (
          <Card
            key={item.id}
            className={styles.kpi__card}
            styles={{
              body: {
                padding: 16,
              },
            }}
          >
            <div className={styles.kpi__label}>{item.label}</div>

            <div className={styles.kpi__content}>
              <div className={styles.kpi__value}>{numberFormatter.format(item.value)}</div>

              <div className={styles.kpi__comparison}>
                <div
                  className={
                    isPositive ? styles['kpi__trend--positive'] : styles['kpi__trend--negative']
                  }
                >
                  {isUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}

                  <span>
                    {isUp ? '+' : '-'}
                    {item.changePercent}%
                  </span>
                </div>

                <span className={styles.kpi__comparisonText}>к предыдущему периоду</span>
              </div>
            </div>
          </Card>
        );
      })}
    </HorizontalScroll>
  );
};

export default DashboardKpiCards;
