import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '../../api/client';

import { AVATAR_UPDATED_EVENT, loadAvatar } from './avatarApi';

export const useProfileAvatar = (userId: string | undefined) => {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarUserId, setAvatarUserId] = useState<string>();

  const reload = useCallback(async () => {
    if (!userId) {
      setAvatar(null);
      setAvatarUserId(undefined);
      return;
    }
    try {
      const nextAvatar = await loadAvatar(userId);
      setAvatar((previousAvatar) => {
        if (previousAvatar) URL.revokeObjectURL(previousAvatar);
        return nextAvatar;
      });
      setAvatarUserId(userId);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      setAvatar((previousAvatar) => {
        if (previousAvatar) URL.revokeObjectURL(previousAvatar);
        return null;
      });
      setAvatarUserId(userId);
    }
  }, [userId]);

  useEffect(() => {
    void Promise.resolve()
      .then(reload)
      .catch(() => undefined);
    window.addEventListener(AVATAR_UPDATED_EVENT, reload);
    return () => {
      window.removeEventListener(AVATAR_UPDATED_EVENT, reload);
    };
  }, [reload]);

  useEffect(
    () => () => {
      if (avatar) URL.revokeObjectURL(avatar);
    },
    [avatar],
  );

  return { avatar: avatarUserId === userId ? avatar : null, reload };
};
