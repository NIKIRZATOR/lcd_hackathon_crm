import { Alert, Button, Checkbox, Flex, Modal, Select, Typography } from 'antd';
import { useMemo, useState } from 'react';

import type { ManagerLoadItem } from '../../types';

import styles from './ManagerReassignModal.module.scss';

const { Text } = Typography;

export type ManagerReassignPayload = {
  fromKamId: string;
  toKamId: string;
  organizationNames: string[];
};

type ManagerReassignModalProps = {
  currentKam: ManagerLoadItem;
  kams: ManagerLoadItem[];
  onCancel: () => void;
  onSubmit: (payload: ManagerReassignPayload) => Promise<void> | void;
};

type OrganizationItem = {
  name: string;
  programsCount: number;
};

const ManagerReassignModal = ({
  currentKam,
  kams,
  onCancel,
  onSubmit,
}: ManagerReassignModalProps) => {
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [targetKamId, setTargetKamId] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const organizations = useMemo<OrganizationItem[]>(() => {
    const organizationsMap = new Map<string, number>();

    currentKam.programItems.forEach((program) => {
      organizationsMap.set(program.university, (organizationsMap.get(program.university) ?? 0) + 1);
    });

    return Array.from(organizationsMap, ([name, programsCount]) => ({
      name,
      programsCount,
    })).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [currentKam.programItems]);

  const targetKam = useMemo(
    () => kams.find((kam) => kam.kamId === targetKamId),
    [kams, targetKamId],
  );

  const kamOptions = useMemo(
    () =>
      kams
        .filter((kam) => kam.kamId !== currentKam.kamId)
        .map((kam) => ({
          value: kam.kamId,
          label: `${kam.kam} · ${kam.activePrograms} программ`,
        })),
    [currentKam.kamId, kams],
  );

  const allOrganizationsSelected =
    organizations.length > 0 && selectedOrganizations.length === organizations.length;

  const someOrganizationsSelected = selectedOrganizations.length > 0 && !allOrganizationsSelected;

  const handleSelectAll = (checked: boolean) => {
    setSelectedOrganizations(checked ? organizations.map((organization) => organization.name) : []);
  };

  const handleSubmit = async () => {
    if (!targetKamId || selectedOrganizations.length === 0) {
      return;
    }

    try {
      setSubmitting(true);

      await onSubmit({
        fromKamId: currentKam.kamId,
        toKamId: targetKamId,
        organizationNames: selectedOrganizations,
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
              onChange={(event) => handleSelectAll(event.target.checked)}
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
              <div key={organization.name} className={styles.organizationRow}>
                <Checkbox value={organization.name}>
                  <Text>{organization.name}</Text>
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
              {targetKam ? (
                <Text>
                  <Text strong>{targetKam.kam}</Text> получит выбранные организации:{' '}
                  {selectedOrganizations.length}.
                </Text>
              ) : (
                <Text>Выберите нового KAM.</Text>
              )}

              <Text type="secondary">
                Вместе с организацией перейдут программы, у которых не назначен собственный KAM.
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
