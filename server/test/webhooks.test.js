'use strict';

/**
 * Integration tests for POST /api/webhooks/paddle.
 *
 * Replays sample Paddle notification payloads through the real Express
 * router and verifies:
 *   1. Signature verification (valid signature accepted, tampered/missing rejected).
 *   2. Idempotent ON CONFLICT upserts (replaying the same event twice yields
 *      exactly one row per (customer_id / subscription_id) in the in-memory DB).
 *   3. Correct routing for each allowed event type (customer.*, subscription.*,
 *      transaction.completed) and that unhandled events are acked with "ignored".
 *
 * The pg pool is stubbed with an in-memory fake so no real database is required.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const express = require('express');
const request = require('supertest');

process.env.PADDLE_WEBHOOK_SECRET = 'pdl_ntfset_test_secret';
process.env.PADDLE_API_KEY = 'pdl_test_key';
process.env.PADDLE_ENVIRONMENT = 'sandbox';
// Prevent db.js from constructing a real Pool against undefined DATABASE_URL.
process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/test';

// ---------- In-memory DB fake (installed into require cache before webhooks.js loads) ----------
const dbPath = require.resolve('../src/db');

const store = {
  customers: new Map(),      // customer_id -> { customer_id, email }
  subscriptions: new Map(),  // subscription_id -> row
  queries: [],               // audit trail
};

function resetStore() {
  store.customers.clear();
  store.subscriptions.clear();
  store.queries.length = 0;
}

/**
 * Minimal SQL executor that understands only the statements webhooks.js
 * actually issues. Every branch mirrors ON CONFLICT semantics so we can
 * assert idempotency end-to-end.
 */
function fakeQuery(sql, params = []) {
  store.queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
  const s = sql.replace(/\s+/g, ' ').trim();

  if (s.startsWith('INSERT INTO customers') && s.includes('ON CONFLICT (customer_id) DO NOTHING')) {
    const [customer_id, email] = params;
    if (!store.customers.has(customer_id)) {
      store.customers.set(customer_id, { customer_id, email });
    }
    return { rows: [], rowCount: 1 };
  }

  if (s.startsWith('INSERT INTO customers') && s.includes('ON CONFLICT (customer_id) DO UPDATE')) {
    const [customer_id, email] = params;
    store.customers.set(customer_id, { customer_id, email });
    return { rows: [], rowCount: 1 };
  }

  if (s.startsWith('INSERT INTO subscriptions') && s.includes('ON CONFLICT (subscription_id) DO UPDATE')) {
    const [
      subscription_id, customer_id, status, price_id, product_id,
      scheduled_change_action, scheduled_change_at,
    ] = params;
    store.subscriptions.set(subscription_id, {
      subscription_id, customer_id, status, price_id, product_id,
      scheduled_change_action, scheduled_change_at,
    });
    return { rows: [], rowCount: 1 };
  }

  if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') {
    return { rows: [], rowCount: 0 };
  }

  throw new Error(`fakeQuery: unhandled SQL: ${s}`);
}

const fakeClient = { query: async (sql, params) => fakeQuery(sql, params) };

const fakeDbModule = {
  pool: { query: async (sql, params) => fakeQuery(sql, params) },
  initSchema: async () => {},
  withTx: async (fn) => fn(fakeClient),
  upsertCustomer: async (client, { customerId, email }) => {
    if (!customerId || !email) return;
    await client.query(
      `INSERT INTO customers (customer_id, email, updated_at)
         VALUES ($1, $2, now())
       ON CONFLICT (customer_id) DO UPDATE
         SET email = EXCLUDED.email, updated_at = now()`,
      [customerId, email],
    );
  },
  upsertSubscription: async (client, sub) => {
    const {
      subscriptionId, customerId, status, priceId, productId,
      scheduledChangeAction = null, scheduledChangeAt = null,
    } = sub;
    if (!subscriptionId || !customerId || !status || !priceId || !productId) return;
    await client.query(
      `INSERT INTO subscriptions (
          subscription_id, customer_id, status, price_id, product_id,
          scheduled_change_action, scheduled_change_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7, now())
       ON CONFLICT (subscription_id) DO UPDATE
         SET customer_id = EXCLUDED.customer_id,
             status = EXCLUDED.status,
             price_id = EXCLUDED.price_id,
             product_id = EXCLUDED.product_id,
             scheduled_change_action = EXCLUDED.scheduled_change_action,
             scheduled_change_at = EXCLUDED.scheduled_change_at,
             updated_at = now()`,
      [subscriptionId, customerId, status, priceId, productId, scheduledChangeAction, scheduledChangeAt],
    );
  },
};

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: fakeDbModule,
};

const webhooks = require('../src/webhooks');

// ---------- App under test ----------
function buildApp() {
  const app = express();
  app.use('/api/webhooks/paddle', express.raw({ type: 'application/json' }), webhooks);
  return app;
}

// ---------- Helpers ----------
function signPaddle(body, secret = process.env.PADDLE_WEBHOOK_SECRET, ts = Math.floor(Date.now() / 1000)) {
  const h1 = createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');
  return `ts=${ts};h1=${h1}`;
}

async function post(app, payload, { signature, secret, rawOverride } = {}) {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const sig = signature ?? signPaddle(raw, secret);
  const bodyToSend = rawOverride ?? raw;
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const resp = await fetch(`http://127.0.0.1:${port}/api/webhooks/paddle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'paddle-signature': sig,
      },
      body: bodyToSend,
    });
    const text = await resp.text();
    return { status: resp.status, text };
  } finally {
    server.close();
  }
}

// ---------- Sample payloads (shape mirrors real Paddle notifications) ----------
const customerCreated = {
  event_id: 'evt_cus_created_1',
  event_type: 'customer.created',
  occurred_at: '2026-07-09T10:00:00.000Z',
  notification_id: 'ntf_1',
  data: {
    id: 'ctm_01abc',
    email: 'alice@example.com',
    status: 'active',
  },
};

const customerUpdated = {
  ...customerCreated,
  event_id: 'evt_cus_updated_1',
  event_type: 'customer.updated',
  data: { ...customerCreated.data, email: 'alice+new@example.com' },
};

function subItem(priceId, productId) {
  return {
    status: 'active',
    quantity: 1,
    recurring: true,
    created_at: '2026-07-09T10:01:00.000Z',
    updated_at: '2026-07-09T10:01:00.000Z',
    previously_billed_at: null,
    next_billed_at: null,
    trial_dates: null,
    price: {
      id: priceId,
      product_id: productId,
      description: 'Test price',
      billing_cycle: { interval: 'month', frequency: 1 },
      trial_period: null,
      tax_mode: 'account_setting',
      unit_price: { amount: '1000', currency_code: 'USD' },
      unit_price_overrides: [],
      quantity: null,
      status: 'active',
    },
    product: null,
  };
}

const subscriptionCreated = {
  event_id: 'evt_sub_created_1',
  event_type: 'subscription.created',
  occurred_at: '2026-07-09T10:01:00.000Z',
  notification_id: 'ntf_2',
  data: {
    id: 'sub_01xyz',
    status: 'active',
    customer_id: 'ctm_01abc',
    address_id: 'add_01',
    business_id: null,
    currency_code: 'USD',
    created_at: '2026-07-09T10:01:00.000Z',
    updated_at: '2026-07-09T10:01:00.000Z',
    started_at: '2026-07-09T10:01:00.000Z',
    first_billed_at: '2026-07-09T10:01:00.000Z',
    next_billed_at: '2026-08-09T10:01:00.000Z',
    paused_at: null,
    canceled_at: null,
    discount: null,
    collection_mode: 'automatic',
    billing_details: null,
    current_billing_period: {
      starts_at: '2026-07-09T10:01:00.000Z',
      ends_at: '2026-08-09T10:01:00.000Z',
    },
    billing_cycle: { interval: 'month', frequency: 1 },
    scheduled_change: null,
    items: [subItem('pri_01', 'pro_01')],
    custom_data: null,
    import_meta: null,
  },
};

const subscriptionUpdated = {
  ...subscriptionCreated,
  event_id: 'evt_sub_updated_1',
  event_type: 'subscription.updated',
  data: {
    ...subscriptionCreated.data,
    status: 'past_due',
    items: [subItem('pri_02', 'pro_01')],
  },
};

const subscriptionCanceled = {
  ...subscriptionCreated,
  event_id: 'evt_sub_canceled_1',
  event_type: 'subscription.canceled',
  data: {
    ...subscriptionCreated.data,
    status: 'canceled',
    canceled_at: '2026-07-09T11:00:00.000Z',
    scheduled_change: {
      action: 'cancel',
      effective_at: '2026-08-01T00:00:00.000Z',
      resume_at: null,
    },
  },
};

const subscriptionCanceled = {
  ...subscriptionCreated,
  event_id: 'evt_sub_canceled_1',
  event_type: 'subscription.canceled',
  data: {
    ...subscriptionCreated.data,
    status: 'canceled',
    scheduled_change: { action: 'cancel', effective_at: '2026-08-01T00:00:00.000Z' },
  },
};

const transactionCompleted = {
  event_id: 'evt_txn_completed_1',
  event_type: 'transaction.completed',
  occurred_at: '2026-07-09T10:02:00.000Z',
  notification_id: 'ntf_3',
  data: {
    id: 'txn_01',
    customer_id: 'ctm_01abc',
    status: 'completed',
  },
};

const unhandledEvent = {
  event_id: 'evt_report_ready_1',
  event_type: 'report.ready',
  occurred_at: '2026-07-09T10:03:00.000Z',
  notification_id: 'ntf_4',
  data: { id: 'rep_01' },
};

// ---------- Tests ----------
test.beforeEach(() => resetStore());

test('rejects request with missing paddle-signature header', async () => {
  const app = buildApp();
  const res = await post(app, customerCreated, { signature: '' });
  assert.equal(res.status, 401);
  assert.equal(store.customers.size, 0);
});

test('rejects request with tampered signature', async () => {
  const app = buildApp();
  const raw = JSON.stringify(customerCreated);
  const sig = signPaddle(raw, 'wrong_secret');
  const res = await post(app, raw, { signature: sig });
  assert.equal(res.status, 401);
  assert.equal(store.customers.size, 0);
});

test('rejects request whose body was mutated after signing', async () => {
  const app = buildApp();
  const raw = JSON.stringify(customerCreated);
  const sig = signPaddle(raw);
  const mutated = raw.replace('alice@example.com', 'attacker@example.com');
  const res = await post(app, raw, { signature: sig, rawOverride: mutated });
  assert.equal(res.status, 401);
});

test('routes customer.created and persists the row', async () => {
  const app = buildApp();
  const res = await post(app, customerCreated);
  assert.equal(res.status, 200);
  assert.equal(res.text, 'ok');
  assert.equal(store.customers.size, 1);
  assert.deepEqual(store.customers.get('ctm_01abc'), {
    customer_id: 'ctm_01abc',
    email: 'alice@example.com',
  });
});

test('routes customer.updated and overwrites email via ON CONFLICT DO UPDATE', async () => {
  const app = buildApp();
  await post(app, customerCreated);
  const res = await post(app, customerUpdated);
  assert.equal(res.status, 200);
  assert.equal(store.customers.size, 1);
  assert.equal(store.customers.get('ctm_01abc').email, 'alice+new@example.com');
});

test('routes subscription.created, backfilling the FK customer row', async () => {
  const app = buildApp();
  const res = await post(app, subscriptionCreated);
  assert.equal(res.status, 200);
  assert.equal(store.subscriptions.size, 1);
  const row = store.subscriptions.get('sub_01xyz');
  assert.equal(row.customer_id, 'ctm_01abc');
  assert.equal(row.status, 'active');
  assert.equal(row.price_id, 'pri_01');
  assert.equal(row.product_id, 'pro_01');
  // FK backfill inserted the customer via ON CONFLICT DO NOTHING.
  assert.equal(store.customers.size, 1);
});

test('routes subscription.updated and mutates the existing row', async () => {
  const app = buildApp();
  await post(app, subscriptionCreated);
  const res = await post(app, subscriptionUpdated);
  assert.equal(res.status, 200);
  assert.equal(store.subscriptions.size, 1);
  const row = store.subscriptions.get('sub_01xyz');
  assert.equal(row.status, 'past_due');
  assert.equal(row.price_id, 'pri_02');
});

test('routes subscription.canceled and records the scheduled change', async () => {
  const app = buildApp();
  await post(app, subscriptionCreated);
  const res = await post(app, subscriptionCanceled);
  assert.equal(res.status, 200);
  const row = store.subscriptions.get('sub_01xyz');
  assert.equal(row.status, 'canceled');
  assert.equal(row.scheduled_change_action, 'cancel');
  assert.ok(row.scheduled_change_at instanceof Date);
});

test('routes transaction.completed and backfills the customer', async () => {
  const app = buildApp();
  const res = await post(app, transactionCompleted);
  assert.equal(res.status, 200);
  assert.equal(store.customers.size, 1);
  assert.equal(store.subscriptions.size, 0);
});

test('acks unhandled event types with "ignored" and writes nothing', async () => {
  const app = buildApp();
  const res = await post(app, unhandledEvent);
  assert.equal(res.status, 200);
  assert.equal(res.text, 'ignored');
  assert.equal(store.customers.size, 0);
  assert.equal(store.subscriptions.size, 0);
});

test('idempotent: replaying customer.created twice yields one row', async () => {
  const app = buildApp();
  await post(app, customerCreated);
  await post(app, customerCreated);
  assert.equal(store.customers.size, 1);
  // Two upsert statements were issued — ON CONFLICT DO UPDATE kept it to one row.
  const upserts = store.queries.filter((q) =>
    q.sql.startsWith('INSERT INTO customers') && q.sql.includes('DO UPDATE'),
  );
  assert.equal(upserts.length, 2);
});

test('idempotent: replaying subscription.created twice yields one row', async () => {
  const app = buildApp();
  await post(app, subscriptionCreated);
  await post(app, subscriptionCreated);
  assert.equal(store.subscriptions.size, 1);
  const subUpserts = store.queries.filter((q) =>
    q.sql.startsWith('INSERT INTO subscriptions'),
  );
  assert.equal(subUpserts.length, 2);
});
