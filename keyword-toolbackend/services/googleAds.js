'use strict';

async function getKeywordData(keyword) {
  return {
    success: true,
    total: 5,
    keywords: [
      {
        keyword: keyword,
        volume: 12000,
        competition: 'MEDIUM',
        cpc: 1.25
      },
      {
        keyword: `${keyword} tools`,
        volume: 5400,
        competition: 'HIGH',
        cpc: 2.10
      },
      {
        keyword: `best ${keyword}`,
        volume: 8100,
        competition: 'LOW',
        cpc: 0.95
      },
      {
        keyword: `${keyword} tutorial`,
        volume: 3200,
        competition: 'LOW',
        cpc: 0.60
      },
      {
        keyword: `${keyword} guide`,
        volume: 2100,
        competition: 'MEDIUM',
        cpc: 1.10
      }
    ]
  };
}

async function checkGoogleAdsConnection() {
  return {
    connected: true
  };
}

module.exports = {
  getKeywordData,
  checkGoogleAdsConnection,
};
