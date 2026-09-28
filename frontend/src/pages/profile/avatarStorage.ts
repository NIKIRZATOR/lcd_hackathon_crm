const key = (userId: string) => `rtk-eduflow:profile-avatar:${userId}`;

export const readAvatar = (userId: string) => {
  try { return localStorage.getItem(key(userId)); } catch { return null; }
};

export const writeAvatar = (userId: string, dataUrl: string) => {
  localStorage.setItem(key(userId), dataUrl);
};

export const clearAvatar = (userId: string) => {
  localStorage.removeItem(key(userId));
};

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];