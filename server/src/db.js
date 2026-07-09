'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id          TEXT PRIMARY KEY,
  customer_id              TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  status                   TEXT NOT NULL,
  price_id                 TEXT NOT NULL,
  product_id               TEXT NOT NULL,
  scheduled_change_action  TEXT,
  scheduled_change_at      TIMESTAMP,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_customer_id_idx ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx      ON subscriptions(status);
`;

async function initSchema() {
  await pool.query(SCHEMA_SQL);
}

async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Idempotent upsert of a customer row.
 */
async function upsertCustomer(client, { customerId, email }) {
  if (!customerId || !email) return;
  await client.query(
    `INSERT INTO customers (customer_id, email, updated_at)
       VALUES ($1, $2, now())
     ON CONFLICT (customer_id) DO UPDATE
       SET email      = EXCLUDED.email,
           updated_at = now()`,
    [customerId, email],
  );
}

/**
 * Idempotent upsert of a subscription row.
 */
async function upsertSubscription(client, sub) {
  const {
    subscriptionId,
    customerId,
    status,
    priceId,
    productId,
    scheduledChangeAction = null,
    scheduledChangeAt = null,
  } = sub;

  if (!subscriptionId || !customerId || !status || !priceId || !productId) return;

  await client.query(
    `INSERT INTO subscriptions (
        subscription_id, customer_id, status, price_id, product_id,
        scheduled_change_action, scheduled_change_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7, now())
     ON CONFLICT (subscription_id) DO UPDATE
       SET customer_id             = EXCLUDED.customer_id,
           status                  = EXCLUDED.status,
           price_id                = EXCLUDED.price_id,
           product_id              = EXCLUDED.product_id,
           scheduled_change_action = EXCLUDED.scheduled_change_action,
           scheduled_change_at     = EXCLUDED.scheduled_change_at,
           updated_at              = now()`,
    [
      subscriptionId,
      customerId,
      status,
      priceId,
      productId,
      scheduledChangeAction,
      scheduledChangeAt,
    ],
  );
}

module.exports = {
  pool,
  initSchema,
  withTx,
  upsertCustomer,
  upsertSubscription,
};
