import { CameraOutlined } from '@ant-design/icons';
import { Avatar, Card, Descriptions, Dropdown, Space, Tag, Typography, message } from 'antd';
import { useMemo } from 'react';

import { useAuth } from '../../auth';
import PageLayout from '../../components/pageLayout/PageLayout';
import {
  AVATAR_TYPES,
  AVATAR_UPDATED_EVENT,
  deleteAvatar,
  MAX_AVATAR_BYTES,
  uploadAvatar,
} from './avatarApi';
import { useProfileAvatar } from './useProfileAvatar';
import styles from './ProfilePage.module.scss';

const roleLabel = (role: string) =>
  role === 'MANAGER'
    ? 'Руководитель'
    : role === 'ADMIN'
      ? 'Администратор'
      : role === 'KAM'
        ? 'KAM'
        : role;

const ProfilePage = () => {
  const { user } = useAuth();
  const { avatar, reload: reloadAvatar } = useProfileAvatar(user?.id);
  const initials = useMemo(
    () => (user?.full_name || user?.username || 'П').trim().slice(0, 1).toUpperCase(),
    [user],
  );
  if (!user)
    return (
      <PageLayout title="Мой профиль">
        <Typography.Text type="secondary">Не удалось загрузить пользователя.</Typography.Text>
      </PageLayout>
    );

  return (
    <PageLayout title="Мой профиль">
      <div className={styles.page}>
        <Card>
          <div className={styles.hero}>
            <div className={styles.avatarWrap}>
              <Avatar size={72} src={avatar || undefined}>
                {initials}
              </Avatar>
              <input
                id={`avatar-file-${user.id}`}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                hidden
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  if (!AVATAR_TYPES.includes(file.type) || file.size > MAX_AVATAR_BYTES) {
                    message.error('Нужен jpg, png или webp до 5 МБ.');
                    return;
                  }
                  try {
                    await uploadAvatar(file);
                    await reloadAvatar();
                    window.dispatchEvent(new Event(AVATAR_UPDATED_EVENT));
                    message.success('Аватар сохранён.');
                  } catch (error) {
                    message.error(
                      error instanceof Error ? error.message : 'Не удалось загрузить аватар.',
                    );
                  }
                }}
              />
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: 'edit',
                      label: 'Изменить фото',
                      onClick: () => document.getElementById(`avatar-file-${user.id}`)?.click(),
                    },
                    ...(avatar
                      ? [
                          {
                            key: 'del',
                            danger: true,
                            label: 'Удалить фото',
                            onClick: async () => {
                              try {
                                await deleteAvatar();
                                await reloadAvatar();
                                window.dispatchEvent(new Event(AVATAR_UPDATED_EVENT));
                                message.success('Аватар удалён.');
                              } catch (error) {
                                message.error(
                                  error instanceof Error
                                    ? error.message
                                    : 'Не удалось удалить аватар.',
                                );
                              }
                            },
                          },
                        ]
                      : []),
                  ],
                }}
              >
                <button type="button" className={styles.edit} aria-label="Изменить аватар">
                  <CameraOutlined />
                </button>
              </Dropdown>
            </div>
            <div className={styles.heroBody}>
              <h1>{user.full_name || user.username}</h1>
              <div className={styles.tags}>
                {user.roles.map((role) => (
                  <Tag key={role}>{roleLabel(role)}</Tag>
                ))}
              </div>
              <Typography.Text type="secondary" className={styles.email}>
                {user.email || 'Email не указан'}
              </Typography.Text>
            </div>
          </div>
        </Card>
        <div className={styles.grid}>
          <Card title="Личные данные">
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label="ФИО">{user.full_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{user.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Username">{user.username || '—'}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card title="Доступ и роль">
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label="Роль">
                {user.roles.map((role) => (
                  <Tag key={role}>{roleLabel(role)}</Tag>
                ))}
              </Descriptions.Item>
              <Descriptions.Item label="Команда">
                {user.team_members.length ? (
                  <Space size={[4, 4]} wrap>
                    {user.team_members.map((member) => (
                      <Tag key={member}>{member}</Tag>
                    ))}
                  </Space>
                ) : (
                  'Не указана'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Руководитель">
                {user.supervisor_name || 'Не указан'}
              </Descriptions.Item>
              <Descriptions.Item label="Статус">
                <Tag color="success">Активен</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};

export default ProfilePage;
