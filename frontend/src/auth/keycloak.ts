import Keycloak from 'keycloak-js';

export const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'rtk-eduflow',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'rtk-eduflow-frontend',
});

let initPromise: Promise<boolean> | undefined;

export const initKeycloak = () => {
  if (!initPromise) {
    initPromise = keycloak.init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    });
  }

  return initPromise;
};
