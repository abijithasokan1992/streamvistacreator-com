'use strict';

/**
 * Integration tests for GET /api/account/portal.
 *
 * Verifies:
 *   1. Redirects (302) to the Paddle-hosted customer portal session URL when the
 *      session guard passes and the user has an active/trialing subscription.
 *   2. Rejects unauthenticated requests with 401 when the session guard fails.
 *   3. Returns 404 when the authenticated user has no mirrored Paddle customer.
 *   4. Returns 404 when the authenticated user has no active/trialing sub.
 *   5. Returns 502 when Paddle responds without a usable portal URL.
 *
 * Both the pg Pool and the Paddle SDK client are stubbed via the require cache
 * so no network or database is required.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

process.env.PADDLE_WEBHOOK_SECRET = 'pdl_ntfset_test_secret';
process.env.PADDLE_API_KEY = 'pdl_test_key';
process.env.PADDLE_ENVIRONMENT = 'sandbox';
process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/test';

// ---------- In-memory DB fake ----------
const dbPath = require.resolve('../src/db');

const store = {
  customersByEmail: new Map(), // email -> customer_id
  subscriptions: [],           // { customer_id, subscription_id, status, updated_at }
};

function resetStore() {
  store.customersByEmail.clear();
  store.subscriptions.length = 0;
}

function fakeQuery(sql, params = []) {
  const s = sql.replace(/\s+/g, ' ').trim();

  if (s.startsWith('SELECT customer_id FROM customers WHERE email')) {
    const [email] = params;
    const customer_id = store.customersByEmail.get(email);
    return { rows: customer_id ? [{ customer_id }] : [], rowCount: customer_id ? 1 : 0 };
  }

  if (s.startsWith('SELECT subscription_id FROM subscriptions')) {
    const [customer_id, statuses] = params;
    const match = store.subscriptions
      .filter((r) => r.customer_id === customer_id && statuses.includes(r.status))
      .sort((a, b) => b.updated_at - a.updated_at)[0];
    return { rows: match ? [{ subscription_id: match.subscription_id }] : [], rowCount: match ? 1 : 0 };
  }

  return { rows: [], rowCount: 0 };
}

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: { pool: { query: fakeQuery, end: async () => {} } },
};

// ---------- Paddle SDK fake ----------
const paddlePath = require.resolve('../src/paddle');

const paddleCalls = [];
let nextSessionResult = {
  urls: { general: { overview: 'https://sandbox-customer-portal.paddle.com/session/abc123' } },
};

require.cache[paddlePath] = {
  id: paddlePath,
  filename: paddlePath,
  loaded: true,
  exports: {
    paddle: {
      customerPortalSessions: {
        create: async (customerId, subscriptionIds) => {
          paddleCalls.push({ customerId, subscriptionIds });
          if (nextSessionResult instanceof Error) throw nextSessionResult;
          return nextSessionResult;
        },
      },
    },
  },
};

// Load router AFTER stubs are installed.
const portalRouter = require('../src/portal');

/** Build an app with a configurable session middleware. */
function makeApp(sessionUser) {
  const app = express();
  app.use((req, _res, next) => {
    if (sessionUser) req.user = sessionUser;
    next();
  });
  app.use('/api/account', portalRouter);
  return app;
}

test.beforeEach(() => {
  resetStore();
  paddleCalls.length = 0;
  nextSessionResult = {
    urls: { general: { overview: 'https://sandbox-customer-portal.paddle.com/session/abc123' } },
  };
});

test('rejects requests when the session guard fails (no req.user)', async () => {
  const app = makeApp(null);
  const res = await request(app).get('/api/account/portal');
  assert.equal(res.status, 401);
  assert.deepEqual(res.body, { error: 'unauthenticated' });
  assert.equal(paddleCalls.length, 0, 'Paddle SDK must not be called when unauthenticated');
});

test('returns 404 when the user has no mirrored Paddle customer', async () => {
  const app = makeApp({ email: 'ghost@example.com' });
  const res = await request(app).get('/api/account/portal');
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: 'no_paddle_customer' });
  assert.equal(paddleCalls.length, 0);
});

test('returns 404 when the user has no active/trialing subscription', async () => {
  store.customersByEmail.set('user@example.com', 'ctm_01');
  store.subscriptions.push({
    customer_id: 'ctm_01',
    subscription_id: 'sub_old',
    status: 'canceled',
    updated_at: 1,
  });
  const app = makeApp({ email: 'user@example.com' });
  const res = await request(app).get('/api/account/portal');
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: 'no_active_subscription' });
  assert.equal(paddleCalls.length, 0);
});

test('redirects (302) to the Paddle portal session overview URL on success', async () => {
  store.customersByEmail.set('user@example.com', 'ctm_01');
  store.subscriptions.push({
    customer_id: 'ctm_01',
    subscription_id: 'sub_active',
    status: 'active',
    updated_at: 10,
  });
  const app = makeApp({ email: 'user@example.com' });

  const res = await request(app).get('/api/account/portal').redirects(0);

  assert.equal(res.status, 302);
  assert.equal(
    res.headers.location,
    'https://sandbox-customer-portal.paddle.com/session/abc123',
  );
  assert.equal(paddleCalls.length, 1);
  assert.deepEqual(paddleCalls[0], {
    customerId: 'ctm_01',
    subscriptionIds: ['sub_active'],
  });
});

test('uses paddleCustomerId from session user when present (skips email lookup)', async () => {
  store.subscriptions.push({
    customer_id: 'ctm_direct',
    subscription_id: 'sub_direct',
    status: 'trialing',
    updated_at: 5,
  });
  const app = makeApp({ paddleCustomerId: 'ctm_direct', email: 'other@example.com' });

  const res = await request(app).get('/api/account/portal').redirects(0);

  assert.equal(res.status, 302);
  assert.match(res.headers.location, /sandbox-customer-portal\.paddle\.com/);
  assert.equal(paddleCalls[0].customerId, 'ctm_direct');
  assert.deepEqual(paddleCalls[0].subscriptionIds, ['sub_direct']);
});

test('falls back to subscription updateSubscription URL when overview is absent', async () => {
  store.customersByEmail.set('user@example.com', 'ctm_01');
  store.subscriptions.push({
    customer_id: 'ctm_01',
    subscription_id: 'sub_active',
    status: 'active',
    updated_at: 10,
  });
  nextSessionResult = {
    urls: {
      subscriptions: [
        { updateSubscription: 'https://sandbox-customer-portal.paddle.com/session/xyz/update' },
      ],
    },
  };
  const app = makeApp({ email: 'user@example.com' });
  const res = await request(app).get('/api/account/portal').redirects(0);
  assert.equal(res.status, 302);
  assert.equal(
    res.headers.location,
    'https://sandbox-customer-portal.paddle.com/session/xyz/update',
  );
});

test('returns 502 when Paddle returns no usable portal URL', async () => {
  store.customersByEmail.set('user@example.com', 'ctm_01');
  store.subscriptions.push({
    customer_id: 'ctm_01',
    subscription_id: 'sub_active',
    status: 'active',
    updated_at: 10,
  });
  nextSessionResult = { urls: {} };
  const app = makeApp({ email: 'user@example.com' });
  const res = await request(app).get('/api/account/portal');
  assert.equal(res.status, 502);
  assert.deepEqual(res.body, { error: 'portal_url_missing' });
});

test('returns 500 when the Paddle SDK throws', async () => {
  store.customersByEmail.set('user@example.com', 'ctm_01');
  store.subscriptions.push({
    customer_id: 'ctm_01',
    subscription_id: 'sub_active',
    status: 'active',
    updated_at: 10,
  });
  nextSessionResult = new Error('paddle down');
  const app = makeApp({ email: 'user@example.com' });
  // Silence expected error log.
  const originalError = console.error;
  console.error = () => {};
  try {
    const res = await request(app).get('/api/account/portal');
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: 'portal_error' });
  } finally {
    console.error = originalError;
  }
});
