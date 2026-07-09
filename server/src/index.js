'use strict';

require('dotenv').config();

const express = require('express');
const webhooks = require('./webhooks');
const portal = require('./portal');
const { initSchema } = require('./db');

const app = express();

// Webhook route MUST receive the raw body (needed for signature verification).
// Mount this BEFORE any global json/urlencoded parsers.
app.use(
  '/api/webhooks/paddle',
  express.raw({ type: 'application/json' }),
  webhooks,
);

// Regular JSON parser for everything else.
app.use(express.json());

// Account/self-service routes.
app.use('/api/account', portal);

app.get('/healthz', (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT || 8787);

initSchema()
  .then(() => {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`[server] listening on :${port}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[server] failed to init schema:', err);
    process.exit(1);
  });

module.exports = app;
