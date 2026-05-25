'use strict';
const express      = require('express');
const { query, validationResult } = require('express-validator');
const router       = express.Router();
const autocomplete = require('../services/autocomplete');
const cache        = require('../services/cache');

const rules = [
  query('q').trim().notEmpty().isLength({ min: 2, max: 120 }).escape(),
  query('platform').optional().isIn(['google','youtube','bing','amazon','duckduckgo','all']).default('google'),
  query('lang').optional().isLength({ max: 5 }).default('en'),
  query('country').optional().isLength({ max: 4 }).default('us'),
];

// GET /api/suggest?q=digital+mark&platform=google&lang=en&country=us
router.get('/', rules, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Invalid parameters' });
  }

  const { q, platform, lang, country } = req.query;

  const cached = cache.getSuggest(q, platform, lang, country);
  if (cached) {
    return res.json({ success: true, suggestions: cached, cached: true });
  }

  try {
    const suggestions = await autocomplete.getSuggestions(q, platform, lang, country);
    cache.setSuggest(q, platform, lang, country, suggestions);
    return res.json({ success: true, suggestions, cached: false });
  } catch (err) {
    console.error('[Suggest] Error:', err.message);
    return res.status(502).json({ success: false, error: 'Failed to fetch suggestions.', suggestions: [] });
  }
});

module.exports = router;
