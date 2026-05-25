'use strict';
require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');

const keywordsRoute = require('./routes/keywords');
const suggestRoute  = require('./routes/suggest');
const healthRoute   = require('./routes/health');
const { keywordLimiter, suggestLimiter } = require('./middleware/rateLimiter');

// ── Validate required env vars ────────────────────────────────────────────────
const required = [
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'GOOGLE_ADS_CLIENT_ID',
  'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_REFRESH_TOKEN',
  'GOOGLE_ADS_CUSTOMER_ID',
];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error('\n❌ Missing required environment variables:');
  missing.forEach(k => console.error(`   - ${k}`));
  console.error('\n👉 Copy .env.example to .env and fill in your credentials.\n');
  process.exit(1);
}

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Allowed origins ───────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    cb(new Error(`CORS blocked: origin ${origin} not allowed`));
  },
  methods:     ['GET', 'OPTIONS'],
  credentials: false,
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/health',   healthRoute);
app.use('/api/keywords', keywordLimiter, keywordsRoute);
app.use('/api/suggest',  suggestLimiter, suggestRoute);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Keyword Metrix Pro Backend`);
  console.log(`   Port    : ${PORT}`);
  console.log(`   Env     : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Origins : ${allowedOrigins.join(', ') || 'all'}`);
  console.log(`\n   API endpoints:`);
  console.log(`   GET /api/health`);
  console.log(`   GET /api/keywords?keyword=seo&country=India&language=English`);
  console.log(`   GET /api/suggest?q=seo&platform=google&lang=en&country=in`);
  console.log(`\n   Press Ctrl+C to stop\n`);
});

module.exports = app;
