import { Alert, Button, Checkbox, Flex, Modal, Select, Typography } from 'antd';
import { useMemo, useState } from 'react';

import type { ManagerKamItem, ManagerLoadItem, ManagerOrganizationHealthItem } from '../../types';

import styles from './ManagerReassignModal.module.scss';

const { Text } = Typography;

export type ManagerReassignPayload = {
  fromKamId: string;
  toKamId: string;
  organizationIds: string[];
};

type ManagerReassignModalProps = {
  currentKam: ManagerLoadItem;
  kams: ManagerKamItem[];
  organizations: ManagerOrganizationHealthItem[];
  error?: string | null;
  onCancel: () => void;
  onSubmit: (payload: ManagerReassignPayload) => Promise<void> | void;
};

const ManagerReassignModal = ({
  currentKam,
  kams,
  organizations: allOrganizations,
  error,
  onCancel,
  onSubmit,
}: ManagerReassignModalProps) => {
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [targetKamId, setTargetKamId] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const organizations = useMemo(
    () =>
      allOrganizations
        .filter((organization) => organization.kamId === currentKam.kamId)
        .sort((a, b) => a.organizationName.localeCompare(b.organizationName, 'ru')),
    [allOrganizations, currentKam.kamId],
  );
  const targetKam = useMemo(
    () => kams.find((kam) => kam.kamId === targetKamId),
    [kams, targetKamId],
  );
  const kamOptions = useMemo(
    () =>
      kams
        .filter((kam) => kam.kamId !== currentKam.kamId)
        .map((kam) => ({ value: kam.kamId, label: kam.kamName })),
    [currentKam.kamId, kams],
  );
  const allOrganizationsSelected =
    organizations.length > 0 && selectedOrganizations.length === organizations.length;
  const someOrganizationsSelected = selectedOrganizations.length > 0 && !allOrganizationsSelected;

  const handleSubmit = async () => {
    if (!targetKamId || selectedOrganizations.length === 0) return;
    try {
      setSubmitting(true);
      await onSubmit({
        fromKamId: currentKam.kamId,
        toKamId: targetKamId,
        organizationIds: selectedOrganizations,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      width={600}
      title="Переназначить организации KAM"
      onCancel={onCancel}
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onCancel} disabled={submitting}>
            Отмена
          </Button>
          <Button
            type="primary"
            loading={submitting}
            disabled={!targetKamId || selectedOrganizations.length === 0}
            onClick={handleSubmit}
          >
            Переназначить
          </Button>
        </Flex>
      }
    >
      <Flex vertical gap={20} className={styles.content}>
        {error && <Alert type="error" message={error} showIcon />}
        <Text type="secondary">
          Выберите организации, которые нужно передать другому KAM. Программы с отдельно назначенным
          KAM останутся без изменений.
        </Text>
        <Flex vertical gap={4}>
          <Text type="secondary">Текущий KAM</Text>
          <Text strong>{currentKam.kam}</Text>
        </Flex>
        <Flex vertical gap={10}>
          <Flex align="center" justify="space-between" gap={16} className={styles.sectionHeader}>
            <Text strong>Организации</Text>
            <Checkbox
              checked={allOrganizationsSelected}
              indeterminate={someOrganizationsSelected}
              onChange={(event) =>
                setSelectedOrganizations(
                  event.target.checked
                    ? organizations.map((organization) => organization.organizationId)
                    : [],
                )
              }
            >
              Выбрать все
            </Checkbox>
          </Flex>
          <Checkbox.Group
            value={selectedOrganizations}
            onChange={(values) => setSelectedOrganizations(values as string[])}
            className={styles.organizationList}
          >
            {organizations.map((organization) => (
              <div key={organization.organizationId} className={styles.organizationRow}>
                <Checkbox value={organization.organizationId}>
                  <Text>{organization.organizationName}</Text>
                </Checkbox>
                <Text type="secondary">Программ: {organization.programsCount}</Text>
              </div>
            ))}
          </Checkbox.Group>
        </Flex>
        <Flex vertical gap={8}>
          <Text strong>Новый KAM</Text>
          <Select
            value={targetKamId}
            options={kamOptions}
            placeholder="Выберите KAM"
            showSearch
            optionFilterProp="label"
            className={styles.select}
            onChange={setTargetKamId}
          />
        </Flex>
        <Alert
          type="info"
          showIcon
          message="После переназначения"
          description={
            <Flex vertical gap={4}>
              <Text>
                {targetKam
                  ? `${targetKam.kamName} получит выбранные организации`
                  : 'Выберите нового KAM'}
                : {selectedOrganizations.length}.
              </Text>
              <Text type="secondary">
                Вместе с организацией перейдут программы без отдельно назначенного KAM.
              </Text>
              <Text type="secondary">Этапы, чеклисты, лицензии и Health не изменятся.</Text>
            </Flex>
          }
        />
      </Flex>
    </Modal>
  );
};

export default ManagerReassignModal;
