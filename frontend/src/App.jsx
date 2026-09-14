import { useEffect, useState } from 'react';

import { getHealth } from './shared/api/client.js';

const appName = import.meta.env.VITE_APP_NAME ?? 'edu_crm';
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const backendStatusText = {
  checking: 'проверяется',
  connected: 'подключен',
  unavailable: 'недоступен',
};

export function App() {
  const [backendStatus, setBackendStatus] = useState('checking');

  useEffect(() => {
    let isMounted = true;

    getHealth()
      .then(() => {
        if (isMounted) {
          setBackendStatus('connected');
        }
      })
      .catch(() => {
        if (isMounted) {
          setBackendStatus('unavailable');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const isConnected = backendStatus === 'connected';

  return (
    <main className="home-shell">
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">Стартовый каркас CRM</p>
          <h1>{appName}</h1>
          <p className="lead">
            Базовый каркас проекта готов. Frontend и backend соединяются через HTTP API.
          </p>
          <div className="status-row" aria-label="Статус приложения">
            <span className="status-item is-ready">Frontend запущен</span>
            <span className={`status-item ${isConnected ? 'is-ready' : 'is-waiting'}`}>
              Backend: {backendStatusText[backendStatus]}
            </span>
          </div>
        </div>
      </section>

      <section className="workspace-grid" aria-label="Рабочая область проекта">
        <article className="info-card">
          <h2>API</h2>
          <p>Backend предоставляет минимальный HTTP API с префиксом /api.</p>
          <div className="link-list">
            <a href={`${apiUrl}/api/health`} target="_blank" rel="noreferrer">
              Проверить health
            </a>
            <a href={`${apiUrl}/docs`} target="_blank" rel="noreferrer">
              Swagger
            </a>
          </div>
        </article>

        <article className="info-card">
          <h2>Frontend</h2>
          <p>React/Vite приложение готово для разработки функциональных модулей.</p>
          <ul>
            <li>фичи для пользовательских сценариев</li>
            <li>сущности для бизнес-сущностей</li>
            <li>страницы для экранов приложения</li>
          </ul>
        </article>

        <article className="info-card">
          <h2>Backend</h2>
          <p>FastAPI modular monolith готов к добавлению доменных модулей.</p>
          <ul>
            <li>университеты, программы, продукты</li>
            <li>взаимодействия, рабочие процессы, задачи</li>
            <li>документы, материалы, аналитика</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
