'use strict';
const NodeCache = require('node-cache');

const kwCache      = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_KEYWORDS) || 3600, checkperiod: 600 });
const suggestCache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_SUGGEST)  || 300,  checkperiod: 60  });

function kwKey(keyword, country, language)     { return `kw:${keyword}:${country}:${language}`.toLowerCase(); }
function suggestKey(query, platform, lang, cc) { return `sg:${query}:${platform}:${lang}:${cc}`.toLowerCase(); }

module.exports = {
  getKeywords:    (k, c, l)       => kwCache.get(kwKey(k, c, l)),
  setKeywords:    (k, c, l, data) => kwCache.set(kwKey(k, c, l), data),
  getSuggest:     (q, p, l, cc)       => suggestCache.get(suggestKey(q, p, l, cc)),
  setSuggest:     (q, p, l, cc, data) => suggestCache.set(suggestKey(q, p, l, cc), data),
  stats: () => ({
    keywords: { keys: kwCache.keys().length, hits: kwCache.getStats().hits, misses: kwCache.getStats().misses },
    suggest:  { keys: suggestCache.keys().length },
  }),
};
