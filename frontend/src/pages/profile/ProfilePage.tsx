import { CameraOutlined } from '@ant-design/icons';
import { Avatar, Button, Card, Descriptions, Dropdown, Tag, Typography, message } from 'antd';
import { useMemo, useState } from 'react';

import { useAuth } from '../../auth';
import { keycloak } from '../../auth/keycloak';
import PageLayout from '../../components/pageLayout/PageLayout';
import { AVATAR_TYPES, MAX_AVATAR_BYTES, clearAvatar, readAvatar, writeAvatar } from './avatarStorage';
import styles from './ProfilePage.module.scss';

const roleLabel = (role: string) => role === 'MANAGER' ? 'Руководитель' : role === 'ADMIN' ? 'Администратор' : role === 'KAM' ? 'KAM' : role;

const ProfilePage = () => {
  const { user } = useAuth();
  const [avatar, setAvatar] = useState(() => user ? readAvatar(user.id) : null);
  const initials = useMemo(() => (user?.full_name || user?.username || 'П').trim().slice(0, 1).toUpperCase(), [user]);
  if (!user) return <PageLayout title="Мой профиль"><Typography.Text type="secondary">Не удалось загрузить пользователя.</Typography.Text></PageLayout>;

  const openPassword = () => {
    const url = typeof keycloak.createAccountUrl === 'function' ? keycloak.createAccountUrl() : '';
    if (url) { window.location.assign(url); return; }
    message.info('Смена пароля через Keycloak пока недоступна.');
  };

  return (
    <PageLayout title="Мой профиль">
      <div className={styles.page}>
        <Card>
          <div className={styles.hero}>
            <div className={styles.avatarWrap}>
              <Avatar size={72} src={avatar || undefined}>{initials}</Avatar>
              <input
                id={`avatar-file-${user.id}`}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  if (!AVATAR_TYPES.includes(file.type) || file.size > MAX_AVATAR_BYTES) {
                    message.error('Нужен jpg, png или webp до 5 МБ.');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUrl = String(reader.result ?? '');
                    writeAvatar(user.id, dataUrl);
                    setAvatar(dataUrl);
                    message.success('Аватар сохранён локально до ответа сервера.');
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    { key: 'edit', label: 'Изменить фото', onClick: () => document.getElementById(`avatar-file-${user.id}`)?.click() },
                    ...(avatar ? [{ key: 'del', danger: true, label: 'Удалить фото', onClick: () => { clearAvatar(user.id); setAvatar(null); } }] : []),
                  ],
                }}
              >
                <button type="button" className={styles.edit} aria-label="Изменить аватар"><CameraOutlined /></button>
              </Dropdown>
            </div>
            <div className={styles.heroBody}>
              <h1>{user.full_name || user.username}</h1>
              <div className={styles.tags}>{user.roles.map((role) => <Tag key={role}>{roleLabel(role)}</Tag>)}</div>
              <Typography.Text type="secondary" className={styles.email}>{user.email || 'Email не указан'}</Typography.Text>
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
              <Descriptions.Item label="Роль">{user.roles.map((role) => <Tag key={role}>{roleLabel(role)}</Tag>)}</Descriptions.Item>
              <Descriptions.Item label="Команда">Не указана</Descriptions.Item>
              <Descriptions.Item label="Руководитель">Не указан</Descriptions.Item>
              <Descriptions.Item label="Статус"><Tag color="success">Активен</Tag></Descriptions.Item>
            </Descriptions>
          </Card>
        </div>
        <Card title="Безопасность">
          <Typography.Paragraph type="secondary" className={styles.secure}>Пароль управляется через Keycloak</Typography.Paragraph>
          <Button onClick={openPassword}>Сменить пароль</Button>
        </Card>
      </div>
    </PageLayout>
  );
};

export default ProfilePage;