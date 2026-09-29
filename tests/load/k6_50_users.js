import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const baseUrl = __ENV.BASE_URL;
const token = __ENV.JWT_TOKEN;
if (!baseUrl || !token) throw new Error('BASE_URL and JWT_TOKEN are required');

export const options = {
  vus: 50,
  duration: __ENV.DURATION || '120s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    http_5xx: ['count==0'],
  },
};

const params = { headers: { Authorization: `Bearer ${token}` } };
export default function () {
  const responses = http.batch([
    ['GET', `${baseUrl}/api/organizations?limit=10`, null, params],
    ['GET', `${baseUrl}/api/workflows/templates?limit=10`, null, params],
    ['GET', `${baseUrl}/api/reports/jobs?limit=10`, null, params],
  ]);
  for (const response of responses) {
    check(response, { 'successful CRM response': (r) => r.status >= 200 && r.status < 300 });
    if (response.status >= 500) http_5xx.add(1);
  }
  sleep(0.2);
}

export const http_5xx = new Counter('http_5xx');
