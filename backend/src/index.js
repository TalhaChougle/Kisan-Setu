// src/index.js — KisanSetu Backend Entry Point
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');

const { errorHandler, notFound } = require('./middleware/error-handler');
const { startPriceCron } = require('./services/price-ingestion');

// ── Route imports ──────────────────────────────────────────────────────────
const authRouter     = require('./routes/auth');
const farmerRouter   = require('./routes/farmers');
const buyerRouter    = require('./routes/buyers');
const lotsRouter     = require('./routes/lots');
const dealsRouter    = require('./routes/deals');
const disputeRouter  = require('./routes/disputes');
const adminRouter    = require('./routes/admin');
const priceModule    = require('./routes/price');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Redis ──────────────────────────────────────────────────────────────────
let redisClient = null;
try {
  redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  redisClient.on('connect', () => console.log('✅ Redis connected'));
  redisClient.on('error', (e) => console.warn('⚠️  Redis error (non-fatal):', e.message));

  // Wire Redis into price route
  priceModule.setRedis(redisClient);
} catch (e) {
  console.warn('⚠️  Redis unavailable — continuing without cache:', e.message);
}

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter (100 req/15min per IP)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // generous for dev/demo
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down.' },
}));

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'kisansetu-backend', timestamp: new Date() });
});

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',     authRouter);
app.use('/api/farmers',  farmerRouter);
app.use('/api/buyers',   buyerRouter);
app.use('/api/lots',     lotsRouter);
app.use('/api/deals',    dealsRouter);
app.use('/api/disputes', disputeRouter);
app.use('/api/admin',    adminRouter);
app.use('/api/price',    priceModule.router);

// ── 404 + Error handlers ───────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 KisanSetu backend running on port ${PORT}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   API: http://localhost:${PORT}/api`);

  // Start daily price ingestion cron
  startPriceCron();
});

module.exports = app;
