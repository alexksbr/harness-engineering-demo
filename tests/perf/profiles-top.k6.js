import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = (__ENV.K6_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const PERF_USER = __ENV.PERF_USER || 'test@test.com';
const PERF_PASS = __ENV.PERF_PASS || 'test1234';
const PERF_MAX_LIMIT = Number(__ENV.PERF_MAX_LIMIT || '100');

const adversarialBoundEnforced = new Rate('adversarial_bound_enforced');

export const options = {
  scenarios: {
    normal_load: {
      executor: 'constant-vus',
      exec: 'normalLoad',
      vus: 20,
      duration: '15s',
    },
    adversarial_load: {
      executor: 'constant-vus',
      exec: 'adversarialLoad',
      vus: 5,
      duration: '15s',
    },
  },
  thresholds: {
    'http_req_duration{scenario:normal_load}': ['p(95)<200'],
    'http_req_failed{scenario:normal_load}': ['rate<0.01'],
    'http_req_duration{scenario:adversarial_load}': ['p(95)<500'],
    'http_req_failed{scenario:adversarial_load}': ['rate<0.05'],
    adversarial_bound_enforced: ['rate>0.95'],
  },
};

export function setup() {
  const loginUrl = `${BASE_URL}/api/users/login`;
  const res = http.post(
    loginUrl,
    JSON.stringify({
      user: {
        email: PERF_USER,
        password: PERF_PASS,
      },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      tags: {
        name: 'profiles_top_login',
      },
    },
  );

  if (res.status !== 200) {
    console.error(
      `[profiles-top.k6] Login failed at ${loginUrl} with status ${res.status}. ` +
        `Seed a test user or set PERF_USER/PERF_PASS for an existing account. ` +
        `Current PERF_USER=${PERF_USER}.`,
    );
    return { token: null };
  }

  let body;
  try {
    body = res.json();
  } catch (error) {
    console.error(`[profiles-top.k6] Login response was not JSON: ${String(error)}`);
    return { token: null };
  }

  if (!body || !body.user || !body.user.token) {
    console.error('[profiles-top.k6] Login succeeded but response did not include user.token.');
    return { token: null };
  }

  return { token: body.user.token };
}

export function normalLoad(data) {
  const res = http.get(`${BASE_URL}/api/profiles/top?limit=10`, requestParams(data, 'profiles_top_normal'));

  check(res, {
    'normal pagination request returns success': (r) => r.status >= 200 && r.status < 300,
  });

  sleep(1);
}

export function adversarialLoad(data) {
  const res = http.get(
    `${BASE_URL}/api/profiles/top?limit=10000`,
    requestParams(data, 'profiles_top_adversarial', true),
  );

  const enforced = isRejectedLimit(res) || isClampedResponse(res);
  adversarialBoundEnforced.add(enforced);

  check(res, {
    'adversarial limit is rejected or clamped': () => enforced,
  });

  sleep(1);
}

function requestParams(data, name, allowLimitRejection) {
  const headers = {
    Accept: 'application/json',
  };

  if (data && data.token) {
    headers.Authorization = `Token ${data.token}`;
  }

  const params = {
    headers,
    tags: {
      name,
    },
  };

  if (allowLimitRejection) {
    params.responseCallback = http.expectedStatuses({ min: 200, max: 399 }, 400, 413, 422);
  }

  return params;
}

function isRejectedLimit(res) {
  return res.status === 400 || res.status === 413 || res.status === 422;
}

function isClampedResponse(res) {
  if (res.status < 200 || res.status >= 300) {
    return false;
  }

  const count = responseItemCount(res);
  return count >= 0 && count <= PERF_MAX_LIMIT;
}

function responseItemCount(res) {
  let body;
  try {
    body = res.json();
  } catch (_) {
    return -1;
  }

  if (Array.isArray(body)) {
    return body.length;
  }

  if (!body || typeof body !== 'object') {
    return -1;
  }

  if (Array.isArray(body.profiles)) {
    return body.profiles.length;
  }

  if (Array.isArray(body.items)) {
    return body.items.length;
  }

  if (Array.isArray(body.data)) {
    return body.data.length;
  }

  return -1;
}
