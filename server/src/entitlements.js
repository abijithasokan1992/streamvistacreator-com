'use strict';

const { pool } = require('./db');

/**
 * ACCESS RULE:
 *  - 'active' and 'trialing' grant paid access.
 *  - A pending `scheduled_change_action` (e.g. cancel at period end) does NOT
 *    revoke access — access is only denied when the primary `status` column
 *    itself becomes 'canceled', 'paused', or 'past_due'.
 */
const PAID_STATUSES = new Set(['active', 'trialing']);
const REVOKED_STATUSES = new Set(['canceled', 'paused', 'past_due']);

async function checkUserPaidAccess(customerId) {
  if (!customerId) return { hasAccess: false, reason: 'missing_customer_id' };

  const { rows } = await pool.query(
    `SELECT subscription_id, status, price_id, product_id,
            scheduled_change_action, scheduled_change_at
       FROM subscriptions
      WHERE customer_id = $1
      ORDER BY updated_at DESC`,
    [customerId],
  );

  if (rows.length === 0) {
    return { hasAccess: false, reason: 'no_subscription' };
  }

  // Prefer any subscription that currently grants access.
  const granting = rows.find((r) => PAID_STATUSES.has(r.status));
  if (granting) {
    return {
      hasAccess: true,
      subscription: granting,
      // Pending scheduled changes are informational only.
      pendingChange: granting.scheduled_change_action || null,
    };
  }

  const latest = rows[0];
  return {
    hasAccess: false,
    reason: REVOKED_STATUSES.has(latest.status) ? latest.status : 'inactive',
    subscription: latest,
  };
}

module.exports = { checkUserPaidAccess, PAID_STATUSES, REVOKED_STATUSES };
