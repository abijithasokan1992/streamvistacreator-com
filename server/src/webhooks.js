'use strict';

const express = require('express');
const { EventName } = require('@paddle/paddle-node-sdk');
const { paddle } = require('./paddle');
const { withTx, upsertCustomer, upsertSubscription } = require('./db');

const router = express.Router();

const HANDLED_EVENTS = new Set([
  EventName.SubscriptionCreated,
  EventName.SubscriptionUpdated,
  EventName.SubscriptionCanceled,
  EventName.CustomerCreated,
  EventName.CustomerUpdated,
  EventName.TransactionCompleted,
]);

function extractSubscription(data) {
  const scheduledChange = data.scheduledChange || null;
  const firstItem = Array.isArray(data.items) && data.items.length > 0 ? data.items[0] : null;
  const priceId = firstItem?.price?.id || firstItem?.priceId || null;
  const productId = firstItem?.price?.productId || firstItem?.product?.id || null;

  return {
    subscriptionId: data.id,
    customerId: data.customerId,
    status: data.status,
    priceId,
    productId,
    scheduledChangeAction: scheduledChange?.action || null,
    scheduledChangeAt: scheduledChange?.effectiveAt
      ? new Date(scheduledChange.effectiveAt)
      : null,
  };
}

/**
 * POST /api/webhooks/paddle
 *
 * IMPORTANT: mount with `express.raw({ type: 'application/json' })` — the
 * raw text body is required for signature verification.
 */
router.post('/', async (req, res) => {
  const signature = req.header('paddle-signature') || '';
  const secret = process.env.PADDLE_WEBHOOK_SECRET;

  if (!secret) {
    // eslint-disable-next-line no-console
    console.error('[paddle-webhook] PADDLE_WEBHOOK_SECRET not configured');
    return res.status(401).send('unauthorized');
  }

  // Body is a Buffer from express.raw — turn it into the exact bytes Paddle signed.
  const rawBody =
    Buffer.isBuffer(req.body) ? req.body.toString('utf8')
    : typeof req.body === 'string' ? req.body
    : '';

  let event;
  try {
    event = await paddle.webhooks.unmarshal(rawBody, secret, signature);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[paddle-webhook] signature verification failed:', err?.message);
    return res.status(401).send('unauthorized');
  }

  if (!event || !HANDLED_EVENTS.has(event.eventType)) {
    // Ignore unrecognized types but ack so Paddle stops retrying.
    return res.status(200).send('ignored');
  }

  try {
    await withTx(async (client) => {
      switch (event.eventType) {
        case EventName.CustomerCreated:
        case EventName.CustomerUpdated: {
          await upsertCustomer(client, {
            customerId: event.data.id,
            email: event.data.email,
          });
          break;
        }

        case EventName.SubscriptionCreated:
        case EventName.SubscriptionUpdated:
        case EventName.SubscriptionCanceled: {
          // Ensure FK target exists even if the customer.* event arrived out of order.
          if (event.data.customerId) {
            await client.query(
              `INSERT INTO customers (customer_id, email)
                    VALUES ($1, $2)
               ON CONFLICT (customer_id) DO NOTHING`,
              [event.data.customerId, event.data.customerEmail || 'unknown@paddle.local'],
            );
          }
          await upsertSubscription(client, extractSubscription(event.data));
          break;
        }

        case EventName.TransactionCompleted: {
          // Mirror the customer if present; transactions themselves are not
          // persisted as their own table per the spec.
          if (event.data.customerId) {
            await client.query(
              `INSERT INTO customers (customer_id, email)
                    VALUES ($1, $2)
               ON CONFLICT (customer_id) DO NOTHING`,
              [event.data.customerId, event.data.customerEmail || 'unknown@paddle.local'],
            );
          }
          break;
        }

        default:
          break;
      }
    });

    return res.status(200).send('ok');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[paddle-webhook] handler error:', err);
    // 500 → Paddle will retry.
    return res.status(500).send('internal error');
  }
});

module.exports = router;
