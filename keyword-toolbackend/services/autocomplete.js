'use strict';
/**
 * Autocomplete Service
 * Fetches REAL suggestions from multiple search engines via backend proxy.
 * NO AI, NO fake arrays — 100% live data.
 */

const axios = require('axios');

const HTTP = axios.create({
  timeout: 5000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
  },
});

// ── Google Suggest ───────────────────────────────────────────────────────────
async function fetchGoogle(query, lang = 'en', country = 'us') {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=&q=${encodeURIComponent(query)}&hl=${lang}&gl=${country.toLowerCase()}`;
    const { data } = await HTTP.get(url);
    return Array.isArray(data) && Array.isArray(data[1]) ? data[1].slice(0, 10) : [];
  } catch {
    return [];
  }
}

// ── YouTube Suggest ──────────────────────────────────────────────────────────
async function fetchYouTube(query, lang = 'en') {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}&hl=${lang}`;
    const { data } = await HTTP.get(url);
    return Array.isArray(data) && Array.isArray(data[1]) ? data[1].slice(0, 10) : [];
  } catch {
    return [];
  }
}

// ── Bing Suggest ─────────────────────────────────────────────────────────────
async function fetchBing(query) {
  try {
    const url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}&form=OSDJAS`;
    const { data } = await HTTP.get(url);
    return Array.isArray(data) && Array.isArray(data[1]) ? data[1].slice(0, 10) : [];
  } catch {
    return [];
  }
}

// ── DuckDuckGo Suggest ───────────────────────────────────────────────────────
async function fetchDuckDuckGo(query) {
  try {
    const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`;
    const { data } = await HTTP.get(url);
    return Array.isArray(data) && Array.isArray(data[1]) ? data[1].slice(0, 10) : [];
  } catch {
    return [];
  }
}

// ── Amazon Suggest ───────────────────────────────────────────────────────────
async function fetchAmazon(query) {
  try {
    const url = `https://completion.amazon.com/api/2017/suggestions?mid=ATVPDKIKX0DER&alias=aps&prefix=${encodeURIComponent(query)}&limit=10`;
    const { data } = await HTTP.get(url);
    if (data?.suggestions) {
      return data.suggestions.map(s => s.value).slice(0, 10);
    }
    return [];
  } catch {
    return [];
  }
}

// ── Wikipedia Suggest (for informational) ────────────────────────────────────
async function fetchWikipedia(query) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=8&format=json&origin=*`;
    const { data } = await HTTP.get(url);
    return Array.isArray(data) && Array.isArray(data[1]) ? data[1].slice(0, 8) : [];
  } catch {
    return [];
  }
}

// ── Merge, dedupe, sort ───────────────────────────────────────────────────────
function mergeSuggestions(arrays, query) {
  const seen  = new Set();
  const result = [];
  const q = query.toLowerCase().trim();

  for (const arr of arrays) {
    for (const s of arr) {
      const clean = String(s).trim().toLowerCase();
      if (!clean || seen.has(clean) || clean === q) continue;
      seen.add(clean);
      result.push(String(s).trim());
    }
  }

  // Sort: exact prefix match first, then by length
  return result.sort((a, b) => {
    const aStarts = a.toLowerCase().startsWith(q) ? -1 : 0;
    const bStarts = b.toLowerCase().startsWith(q) ? -1 : 0;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.length - b.length;
  }).slice(0, 20);
}

// ── Main export ───────────────────────────────────────────────────────────────
async function getSuggestions(query, platform = 'all', lang = 'en', country = 'us') {
  if (!query || query.trim().length < 2) return [];

  const q = query.trim();

  let results;

  switch (platform) {
    case 'youtube':
      results = await Promise.allSettled([fetchYouTube(q, lang)]);
      break;
    case 'bing':
      results = await Promise.allSettled([fetchBing(q)]);
      break;
    case 'amazon':
      results = await Promise.allSettled([fetchAmazon(q)]);
      break;
    case 'duckduckgo':
      results = await Promise.allSettled([fetchDuckDuckGo(q)]);
      break;
    case 'google':
    default:
      // For "all" or "google" — fetch all sources in parallel
      results = await Promise.allSettled([
        fetchGoogle(q, lang, country),
        fetchYouTube(q, lang),
        fetchBing(q),
        fetchDuckDuckGo(q),
        fetchAmazon(q),
      ]);
      break;
  }

  const arrays = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  return mergeSuggestions(arrays, q);
}

module.exports = { getSuggestions };
