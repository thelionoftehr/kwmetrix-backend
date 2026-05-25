'use strict';
const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const max      = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 30;

// Keyword search — stricter (costs Google Ads API quota)
const keywordLimiter = rateLimit({
  windowMs,
  max: Math.floor(max / 3),
  message: { success: false, error: 'Too many keyword searches. Please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Autocomplete — more generous
const suggestLimiter = rateLimit({
  windowMs,
  max,
  message: { success: false, error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { keywordLimiter, suggestLimiter };
