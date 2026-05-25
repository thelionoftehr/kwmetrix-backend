'use strict';

const { GoogleAdsApi } = require('google-ads-api');

let client = null;

function getClient() {
  if (client) return client;

  client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  return client;
}

function getCustomer() {
  const api = getClient();

  return api.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });
}

const LANGUAGE_CODES = {
  English: 1000,
  Hindi: 1023,
  Spanish: 1003,
  French: 1002,
  German: 1001,
};

const GEO_TARGET_CODES = {
  Worldwide: null,
  USA: 2840,
  India: 2356,
  UK: 2826,
  Canada: 2124,
  Australia: 2036,
};

async function fetchKeywordIdeas(
  keyword,
  country = 'Worldwide',
  language = 'English'
) {
  try {
    const customer = getCustomer();

    const langCode = LANGUAGE_CODES[language] || 1000;
    const geoCode = GEO_TARGET_CODES[country] || null;

    const request = {
      customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
      language: `languageConstants/${langCode}`,
      keyword_seed: {
        keywords: [keyword],
      },
      include_adult_keywords: false,
    };

    if (geoCode) {
      request.geo_target_constants = [
        `geoTargetConstants/${geoCode}`,
      ];
    }

    const response =
      await customer.keywordPlanIdeas.generateKeywordIdeas(request);

    const results = [];

    for (const idea of response.results || []) {
      const metrics = idea.keyword_idea_metrics || {};

      const avgSearches =
        metrics.avg_monthly_searches || 0;

      const competitionMap = {
        LOW: 'Low',
        MEDIUM: 'Medium',
        HIGH: 'High',
      };

      const competition =
        competitionMap[metrics.competition] || 'Unknown';

      const lowBid = metrics.low_top_of_page_bid_micros
        ? metrics.low_top_of_page_bid_micros / 1000000
        : 0;

      const highBid = metrics.high_top_of_page_bid_micros
        ? metrics.high_top_of_page_bid_micros / 1000000
        : 0;

      const cpc =
        lowBid && highBid
          ? ((lowBid + highBid) / 2).toFixed(2)
          : 0;

      results.push({
        keyword: idea.text,
        volume: avgSearches,
        competition,
        cpc: Number(cpc),
        lowBid,
        highBid,
      });
    }

    return results;
  } catch (err) {
    console.error('Google Ads API Error:', err);

    throw new Error(
      err.message || 'Google Ads API request failed'
    );
  }
}

async function getKeywordData(keyword, country, language) {
  const keywords = await fetchKeywordIdeas(
    keyword,
    country,
    language
  );

  return {
    success: true,
    keyword,
    country,
    language,
    total: keywords.length,
    keywords,
  };
}

async function checkGoogleAdsConnection() {
  try {
    const customer = getCustomer();

    await customer.query(`
      SELECT customer.id
      FROM customer
      LIMIT 1
    `);

    return {
      connected: true,
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
    };
  }
}

module.exports = {
  getKeywordData,
  checkGoogleAdsConnection,
};
