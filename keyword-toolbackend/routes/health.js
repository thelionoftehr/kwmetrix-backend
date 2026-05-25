'use strict';
const express   = require('express');
const router    = express.Router();
const googleAds = require('../services/googleAds');
const cache     = require('../services/cache');

// GET /api/health
router.get('/', async (req, res) => {
  const gads = await googleAds.checkGoogleAdsConnection();
  const cacheStats = cache.stats();
  res.json({
    success: true,
    status:  'ok',
    uptime:  Math.round(process.uptime()) + 's',
    services: {
      googleAds: gads.connected ? 'connected' : 'error',
      googleAdsError: gads.error || null,
    },
    cache: cacheStats,
    node: process.version,
    env:  process.env.NODE_ENV || 'development',
  });
});

module.exports = router;
