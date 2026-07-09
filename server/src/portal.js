'use strict';

const express = require('express');
const { paddle } = require('./paddle');
const { pool } = require('./db');
const { PAID_STATUSES } = require('./entitlements');

const router = express.Router();

/**
 * Placeholder session middleware. Replace `resolveSessionUser` with your real
 * auth (JWT decode, session cookie lookup, etc.). The critical guarantee is
 * that the customer id is derived server-side from the authenticated user —
 * never from `req.query` or `req.body`.
 */
async function resolveSessionUser(req) {
  // Expect upstream auth middleware to attach `req.user`.
  return req.user || null;
}

/**
 * GET /api/account/portal
 * Redirects the authenticated user to a Paddle-hosted customer portal session.
 */
router.get('/portal', async (req, res) => {
  try {
    const user = await resolveSessionUser(req);
    if (!user) return res.status(401).json({ error: 'unauthenticated' });

    // Look up the mirrored Paddle customer id for this internal user.
    // `user.paddleCustomerId` should be populated by your signup/link flow;
    // fall back to an email match against the mirror table.
    let paddleCustomerId = user.paddleCustomerId || null;
    if (!paddleCustomerId && user.email) {
      const { rows } = await pool.query(
        `SELECT customer_id FROM customers WHERE email = $1 LIMIT 1`,
        [user.email],
      );
      paddleCustomerId = rows[0]?.customer_id || null;
    }

    if (!paddleCustomerId) {
      return res.status(404).json({ error: 'no_paddle_customer' });
    }

    // Find an active/trialing subscription to scope the portal to.
    const statuses = Array.from(PAID_STATUSES);
    const { rows: subs } = await pool.query(
      `SELECT subscription_id
         FROM subscriptions
        WHERE customer_id = $1 AND status = ANY($2::text[])
        ORDER BY updated_at DESC
        LIMIT 1`,
      [paddleCustomerId, statuses],
    );

    const subscriptionId = subs[0]?.subscription_id;
    if (!subscriptionId) {
      return res.status(404).json({ error: 'no_active_subscription' });
    }

    const session = await paddle.customerPortalSessions.create(
      paddleCustomerId,
      [subscriptionId],
    );

    const url =
      session?.urls?.general?.overview ||
      session?.urls?.subscriptions?.[0]?.updateSubscription ||
      null;

    if (!url) {
      return res.status(502).json({ error: 'portal_url_missing' });
    }

    return res.redirect(302, url);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[portal] error:', err);
    return res.status(500).json({ error: 'portal_error' });
  }
});

module.exports = router;
