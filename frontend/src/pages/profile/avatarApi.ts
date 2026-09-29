import { apiDownload, apiRequest } from '../../api/client';

export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const AVATAR_UPDATED_EVENT = 'rtk-eduflow:avatar-updated';

export const loadAvatar = async (userId: string) =>
  URL.createObjectURL(
    await apiDownload(`/api/users/me/avatar?user=${encodeURIComponent(userId)}`, {
      cache: 'no-store',
    }),
  );

export const uploadAvatar = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<{ has_avatar: boolean }>('/api/users/me/avatar', {
    method: 'POST',
    body: form,
  });
};

export const deleteAvatar = () =>
  apiRequest<{ has_avatar: boolean }>('/api/users/me/avatar', { method: 'DELETE' });
