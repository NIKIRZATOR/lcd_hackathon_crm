import http from 'k6/http';
import { check } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:8088';

export default function () {
  const response = http.get(`${baseUrl}/health`);
  check(response, { 'health endpoint returns 200': (result) => result.status === 200 });
}
