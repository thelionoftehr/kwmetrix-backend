'use strict';
/**
 * Google Ads API Service
 * Uses KeywordPlanIdeaService to fetch REAL keyword metrics:
 * - Search Volume, CPC, Competition, Monthly Trends
 */

const { GoogleAdsApi, enums } = require('google-ads-api');

let _client = null;

function getClient() {
  if (_client) return _client;
  _client = new GoogleAdsApi({
    client_id:     process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });
  return _client;
}

function getCustomer() {
  const client = getClient();
  return client.Customer({
    customer_id:   process.env.GOOGLE_ADS_CUSTOMER_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });
}

// ── Language & Country code maps ────────────────────────────────────────────
const LANGUAGE_CODES = {
  English: 1000, Hindi: 1023, Spanish: 1003,
  French: 1002, German: 1001, Arabic: 1019,
  Portuguese: 1004, Japanese: 1005, Chinese: 1017,
};

const GEO_TARGET_CODES = {
  Worldwide: null,
  USA:       2840,
  India:     2356,
  UK:        2826,
  Australia: 2036,
  Canada:    2124,
  Germany:   2276,
  Singapore: 2702,
  UAE:       2784,
};

// ── Main keyword research function ──────────────────────────────────────────
async function fetchKeywordIdeas(keyword, country = 'Worldwide', language = 'English') {
  const customer = getCustomer();

  const langCode = LANGUAGE_CODES[language] || 1000;
  const geoCode  = GEO_TARGET_CODES[country] || null;

  const geoTargets = geoCode
    ? [`geoTargetConstants/${geoCode}`]
    : [];

  const response = await customer.keywordPlanIdeas.generateKeywordIdeas({
    language:   `languageConstants/${langCode}`,
    geo_target_constants: geoTargets,
    include_adult_keywords: false,
    keyword_seed: { keywords: [keyword] },
    page_size: 25,
  });

  const keywords = [];

  for (const idea of response) {
    const metrics  = idea.keyword_idea_metrics || {};
    const monthly  = metrics.monthly_search_volumes || [];
    const kw       = idea.text || '';

    // Competition score: LOW=0, MEDIUM=1, HIGH=2
    const compEnum = metrics.competition ?? 0;
    const compScore = compEnum === 0 ? 20 : compEnum === 1 ? 55 : 85;
    const compLabel = compEnum === 0 ? 'Low' : compEnum === 1 ? 'Medium' : 'High';

    const avgVol = metrics.avg_monthly_searches
      ? Number(metrics.avg_monthly_searches)
      : 0;

    const lowBid  = metrics.low_top_of_page_bid_micros
      ? Number(metrics.low_top_of_page_bid_micros) / 1_000_000
      : null;
    const highBid = metrics.high_top_of_page_bid_micros
      ? Number(metrics.high_top_of_page_bid_micros) / 1_000_000
      : null;

    const cpc = lowBid && highBid ? +((lowBid + highBid) / 2).toFixed(2) : null;

    // Monthly trend (last 12 months)
    const monthlyTrend = monthly.slice(-12).map(m => ({
      month:  m.month,
      year:   m.year,
      volume: Number(m.monthly_searches || 0),
    }));

    // Trend % — compare last vs prev month
    let trend = null;
    if (monthlyTrend.length >= 2) {
      const last = monthlyTrend[monthlyTrend.length - 1].volume;
      const prev = monthlyTrend[monthlyTrend.length - 2].volume;
      if (prev > 0) trend = Math.round(((last - prev) / prev) * 100);
    }

    // KD estimate based on competition + bid
    const kd = calcKD(compScore, highBid, avgVol);

    // Intent classification
    const intent = classifyIntent(kw);
    const cluster = classifyCluster(kw, keyword);

    keywords.push({
      keyword:        kw,
      volume:         avgVol,
      trend,
      kd,
      cpc,
      competitionScore: compScore,
      competition:    compLabel,
      intent,
      cluster,
      bidLow:         lowBid  ? +lowBid.toFixed(2)  : null,
      bidHigh:        highBid ? +highBid.toFixed(2) : null,
      monthlyTrend,
    });
  }

  // Sort: exact match first, then by volume
  keywords.sort((a, b) => {
    if (a.keyword.toLowerCase() === keyword.toLowerCase()) return -1;
    if (b.keyword.toLowerCase() === keyword.toLowerCase()) return 1;
    return b.volume - a.volume;
  });

  return keywords;
}

// ── KD Estimation (based on real competition + bid data) ────────────────────
function calcKD(compScore, highBid, volume) {
  let kd = Math.round(compScore * 0.55);
  if (highBid) kd += Math.min(20, Math.round(highBid * 3));
  if (volume > 100000) kd += 15;
  else if (volume > 10000) kd += 8;
  return Math.min(100, Math.max(1, kd));
}

// ── Intent Classification ────────────────────────────────────────────────────
function classifyIntent(kw) {
  const k = kw.toLowerCase();
  if (/^(buy|purchase|order|shop|price|cheap|deal|discount|coupon|promo|get|hire|cost|quote|subscription|book|reserve|download|trial|free trial)/i.test(k))
    return 'Transactional';
  if (/^(best|top|review|vs|compare|comparison|alternative|versus|rated|recommended|which)/i.test(k))
    return 'Commercial';
  if (/^(how|what|why|when|where|who|guide|tutorial|learn|tips|tricks|does|is|are|can|should|explain|define|meaning|examples|difference)/i.test(k))
    return 'Informational';
  if (/(official|login|sign in|website|homepage|account|portal)/i.test(k))
    return 'Navigational';
  // keyword length heuristic
  const words = kw.split(' ').length;
  if (words >= 4) return 'Informational';
  return 'Commercial';
}

// ── Cluster Classification ────────────────────────────────────────────────────
function classifyCluster(kw, seed) {
  const k = kw.toLowerCase();
  const s = seed.toLowerCase();
  if (k === s) return 'Core';
  if (/(tutorial|guide|learn|how to|step|course|training|beginner)/i.test(k)) return 'Learning';
  if (/(buy|price|cost|cheap|deal|free|trial|plan|pricing)/i.test(k))          return 'Commercial';
  if (/(tool|software|app|platform|service|agency)/i.test(k))                  return 'Tools';
  if (/(best|top|vs|review|compare|alternative)/i.test(k))                     return 'Research';
  if (/(local|near me|city|location)/i.test(k))                                return 'Local';
  return 'General';
}

// ── Build stats summary ──────────────────────────────────────────────────────
function buildStats(keywords) {
  const total      = keywords.length;
  const totalVol   = keywords.reduce((s, k) => s + (k.volume || 0), 0);
  const avgKd      = total ? Math.round(keywords.reduce((s, k) => s + (k.kd || 0), 0) / total) : 0;
  const topBid     = Math.max(...keywords.map(k => k.bidHigh || 0));
  const avgCompNum = total ? keywords.reduce((s, k) => s + (k.competitionScore || 0), 0) / total : 0;
  const avgComp    = avgCompNum < 35 ? 'Low' : avgCompNum < 65 ? 'Medium' : 'High';

  // Avg trend
  const withTrend = keywords.filter(k => k.trend != null);
  const avgTrend  = withTrend.length
    ? Math.round(withTrend.reduce((s, k) => s + k.trend, 0) / withTrend.length)
    : null;

  return { total, totalVolume: totalVol, avgTrend: avgTrend != null ? `${avgTrend > 0 ? '+' : ''}${avgTrend}%` : '—', topBid: topBid || null, avgComp, avgKd };
}

// ── Build question keywords ──────────────────────────────────────────────────
function buildQuestions(keywords, seed) {
  const prefixes = ['how', 'what', 'why', 'when', 'where', 'who', 'which', 'best', 'is', 'does', 'can', 'should'];
  return keywords
    .filter(k => prefixes.some(p => k.keyword.toLowerCase().startsWith(p)))
    .slice(0, 12)
    .map(k => ({ keyword: k.keyword, intent: k.intent }));
}

// ── Build long-tail keywords ─────────────────────────────────────────────────
function buildLongTail(keywords) {
  return keywords
    .filter(k => k.keyword.split(' ').length >= 4)
    .slice(0, 16)
    .map(k => ({ keyword: k.keyword, intent: k.intent }));
}

// ── Build clusters ───────────────────────────────────────────────────────────
function buildClusters(keywords) {
  const clusters = {};
  keywords.forEach(k => {
    if (!clusters[k.cluster]) clusters[k.cluster] = [];
    clusters[k.cluster].push({ keyword: k.keyword, volume: k.volume });
  });
  return clusters;
}

// ── Intent distribution ──────────────────────────────────────────────────────
function buildIntentDist(keywords) {
  const dist = { Informational: 0, Navigational: 0, Transactional: 0, Commercial: 0 };
  keywords.forEach(k => { if (dist[k.intent] !== undefined) dist[k.intent]++; });
  return dist;
}

// ── Main export ──────────────────────────────────────────────────────────────
async function getKeywordData(keyword, country, language) {
  const keywords = await fetchKeywordIdeas(keyword, country, language);
  return {
    stats:              buildStats(keywords),
    keywords,
    questions:          buildQuestions(keywords, keyword),
    longTail:           buildLongTail(keywords),
    clusters:           buildClusters(keywords),
    intentDistribution: buildIntentDist(keywords),
    relatedKeywords:    keywords.slice(0, 16).map(k => k.keyword),
  };
}

// ── Health check ─────────────────────────────────────────────────────────────
async function checkGoogleAdsConnection() {
  try {
    const customer = getCustomer();
    // Light query to verify credentials
    await customer.query(`SELECT customer.id FROM customer LIMIT 1`);
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

module.exports = { getKeywordData, checkGoogleAdsConnection };
