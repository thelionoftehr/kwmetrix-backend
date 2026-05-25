'use strict';
const express   = require('express');
const { query, validationResult } = require('express-validator');
const router    = express.Router();
const googleAds = require('../services/googleAds');
const cache     = require('../services/cache');

// Validation rules
const rules = [
  query('keyword').trim().notEmpty().isLength({ min: 1, max: 150 }).escape(),
  query('country').optional().isIn(['Worldwide','USA','India','UK','Australia','Canada','Germany','Singapore','UAE']).default('Worldwide'),
  query('language').optional().isIn(['English','Hindi','Spanish','French','German','Arabic','Portuguese','Japanese','Chinese']).default('English'),
];

// GET /api/keywords?keyword=digital+marketing&country=India&language=English
router.get('/', rules, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Invalid parameters', details: errors.array() });
  }

  const { keyword, country, language } = req.query;

  // Cache check
  const cached = cache.getKeywords(keyword, country, language);
  if (cached) {
    return res.json({ success: true, data: cached, cached: true });
  }

  try {
    const data = await googleAds.getKeywordData(keyword, country, language);
    cache.setKeywords(keyword, country, language, data);
    return res.json({ success: true, data, cached: false });
  } catch (err) {
    console.error('[Keywords] Error:', err.message);

    // Provide meaningful errors to frontend
    let userMsg = 'Failed to fetch keyword data from Google Ads API.';
    if (err.message?.includes('AUTHENTICATION_ERROR') || err.message?.includes('401')) {
      userMsg = 'Google Ads API authentication failed. Check your credentials in .env';
    } else if (err.message?.includes('QUOTA_ERROR') || err.message?.includes('429')) {
      userMsg = 'Google Ads API quota exceeded. Please wait and try again.';
    } else if (err.message?.includes('INVALID_CUSTOMER')) {
      userMsg = 'Invalid Google Ads Customer ID. Check GOOGLE_ADS_CUSTOMER_ID in .env';
    } else if (err.message?.includes('PERMISSION_DENIED')) {
      userMsg = 'Permission denied. Ensure your Google Ads account has API access enabled.';
    }

    return res.status(502).json({ success: false, error: userMsg, detail: err.message });
  }
});

module.exports = router;
