import {
  DownloadOutlined,
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Dropdown, Empty, Tooltip, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import { useMemo, useRef, useState } from 'react';

import EChart from '../../../../../shared/charts/EChart/EChart';
import {
  exportElement,
  type ElementExportFormat,
} from '../../../../../shared/export/exportElement';

import type { ManagerProgramsRatingItem } from '../../types';

import { getManagerProgramsRatingOption } from './options';

import styles from './ManagerProgramsRating.module.scss';

const { Text, Title } = Typography;

type ManagerProgramsRatingProps = {
  items: ManagerProgramsRatingItem[];
  loading?: boolean;
  error?: string | null;
  onShowInReports: () => void;
};

const DOWNLOAD_ITEMS: MenuProps['items'] = [
  {
    key: 'png',
    icon: <FileImageOutlined />,
    label: 'PNG (.png)',
  },
  {
    key: 'jpeg',
    icon: <FileImageOutlined />,
    label: 'JPEG (.jpeg)',
  },
  {
    key: 'svg',
    icon: <FileOutlined />,
    label: 'SVG (.svg)',
  },
  {
    key: 'pdf',
    icon: <FilePdfOutlined />,
    label: 'PDF (.pdf)',
  },
];

const ManagerProgramsRating = ({
  items,
  loading = false,
  error = null,
  onShowInReports,
}: ManagerProgramsRatingProps) => {
  const exportRef = useRef<HTMLDivElement>(null);

  const { token } = theme.useToken();

  const [isExporting, setIsExporting] = useState(false);

  const topItems = useMemo(
    () => [...items].sort((first, second) => second.demandIndex - first.demandIndex).slice(0, 3),
    [items],
  );

  const option = useMemo(
    () =>
      getManagerProgramsRatingOption(topItems, {
        primaryColor: token.colorPrimary,
        trackColor: token.colorFillSecondary,
        textColor: token.colorText,
        textSecondaryColor: token.colorTextSecondary,
        fontFamily: token.fontFamily,
      }),
    [
      topItems,
      token.colorPrimary,
      token.colorFillSecondary,
      token.colorText,
      token.colorTextSecondary,
      token.fontFamily,
    ],
  );

  const handleDownload = async (format: ElementExportFormat) => {
    if (!exportRef.current) {
      return;
    }

    try {
      setIsExporting(true);

      await exportElement(exportRef.current, format, 'programs-rating-top-3');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadMenuClick: MenuProps['onClick'] = ({ key }) => {
    void handleDownload(key as ElementExportFormat);
  };

  const isDownloadDisabled = Boolean(error) || !topItems.length || isExporting;

  return (
    <Card
      className={styles.card}
      classNames={{
        body: styles.cardBody,
      }}
      loading={loading}
    >
      <div ref={exportRef} className={styles.exportContent}>
        <div className={styles.header}>
          <div>
            <Title level={4} className={styles.title}>
              Рейтинг программ
            </Title>

            <Text type="secondary" className={styles.subtitle}>
              Топ-3 по индексу востребованности
            </Text>
          </div>

          <div data-export-ignore="true">
            <Dropdown
              menu={{
                items: DOWNLOAD_ITEMS,
                onClick: handleDownloadMenuClick,
              }}
              trigger={['click']}
              placement="bottomRight"
              disabled={isDownloadDisabled}
            >
              <Tooltip title="Скачать">
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  className={styles.downloadButton}
                  loading={isExporting}
                  disabled={Boolean(error) || !topItems.length}
                  aria-label="Скачать рейтинг программ"
                />
              </Tooltip>
            </Dropdown>
          </div>
        </div>

        {error ? (
          <div className={styles.state}>
            <Alert
              type="error"
              showIcon
              message="Не удалось загрузить рейтинг программ"
              description="Обновите страницу и попробуйте ещё раз."
            />
          </div>
        ) : topItems.length > 0 ? (
          <div className={styles.chartWrapper}>
            <EChart option={option} />
          </div>
        ) : (
          <div className={styles.empty}>
            <Empty description="Нет данных для рейтинга" />
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Button type="link" className={styles.reportsButton} onClick={onShowInReports}>
          Открыть в отчётах
          <RightOutlined />
        </Button>
      </div>
    </Card>
  );
};

export default ManagerProgramsRating;
