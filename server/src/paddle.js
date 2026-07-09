'use strict';

const { Paddle, Environment } = require('@paddle/paddle-node-sdk');

if (!process.env.PADDLE_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[paddle] PADDLE_API_KEY not set — Paddle SDK calls will fail until configured.');
}

const environment =
  (process.env.PADDLE_ENVIRONMENT || 'sandbox').toLowerCase() === 'production'
    ? Environment.production
    : Environment.sandbox;

const paddle = new Paddle(process.env.PADDLE_API_KEY || 'missing', {
  environment,
});

module.exports = { paddle };
