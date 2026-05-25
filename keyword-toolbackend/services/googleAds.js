'use strict';

const axios = require('axios');

async function getAccessToken() {
  const response = await axios.post(
    'https://oauth2.googleapis.com/token',
    new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data.access_token;
}

async function getKeywordData(keyword) {
  try {
    const accessToken = await getAccessToken();

    const url = `https://googleads.googleapis.com/v17/customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/keywordPlans:generateKeywordIdeas`;

    const response = await axios.post(
      url,
      {
        language: 'languageConstants/1000',
        geoTargetConstants: ['geoTargetConstants/2840'],
        keywordSeed: {
          keywords: [keyword],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token':
            process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    const ideas = response.data.results || [];

    return {
      success: true,
      total: ideas.length,
      keywords: ideas.map((item) => ({
        keyword: item.text,
        volume:
          item.keywordIdeaMetrics?.avgMonthlySearches || 0,
        competition:
          item.keywordIdeaMetrics?.competition || 'UNKNOWN',
        cpc:
          item.keywordIdeaMetrics?.averageCpcMicros
            ? item.keywordIdeaMetrics.averageCpcMicros /
              1000000
            : 0,
      })),
    };
  } catch (err) {
    console.error(
      'Google Ads REST Error:',
      err.response?.data || err.message
    );

    throw new Error(
      err.response?.data?.error?.message ||
        err.message
    );
  }
}

async function checkGoogleAdsConnection() {
  try {
    await getAccessToken();

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
