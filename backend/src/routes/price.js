// routes/price.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getPriceTrend, getSaleRecommendation, getLatestPrice } = require('../services/price-ingestion');

const router = express.Router();
const prisma = new PrismaClient();

let redisClient = null;
function setRedis(client) { redisClient = client; }

/**
 * GET /api/price/commodities
 * List all commodities with latest prices
 */
router.get('/commodities', async (req, res, next) => {
  try {
    const commodities = await prisma.priceIndex.findMany({
      distinct: ['commodity'],
      orderBy: { date: 'desc' },
      select: { commodity: true, variety: true },
    });
    res.json({ success: true, commodities });
  } catch (err) { next(err); }
});

/**
 * GET /api/price/regions
 * List all regions
 */
router.get('/regions', async (req, res, next) => {
  try {
    const regions = await prisma.priceIndex.findMany({
      distinct: ['region'],
      select: { region: true, state: true },
    });
    res.json({ success: true, regions });
  } catch (err) { next(err); }
});

/**
 * GET /api/price/latest?commodity=Wheat&region=Pune
 * Latest price for a commodity-region pair (Redis-cached)
 */
router.get('/latest', async (req, res, next) => {
  try {
    const { commodity, region } = req.query;
    if (!commodity || !region) {
      return res.status(400).json({ success: false, message: 'commodity and region are required.' });
    }
    const price = await getLatestPrice(commodity, region, redisClient);
    if (!price) return res.status(404).json({ success: false, message: 'No price data found.' });
    res.json({ success: true, price });
  } catch (err) { next(err); }
});

/**
 * GET /api/price/trend?commodity=Wheat&region=Pune&days=30
 * Price trend data for charts (FR-9) — paginated by days
 */
router.get('/trend', async (req, res, next) => {
  try {
    const { commodity, region, days = '30' } = req.query;
    if (!commodity || !region) {
      return res.status(400).json({ success: false, message: 'commodity and region required.' });
    }
    const daysNum = Math.min(90, Math.max(7, parseInt(days) || 30));
    const trend = await getPriceTrend(commodity, region, daysNum);
    res.json({ success: true, commodity, region, days: daysNum, trend });
  } catch (err) { next(err); }
});

/**
 * GET /api/price/recommendation?commodity=Wheat&region=Pune
 * Sale-window recommendation (FR-10)
 */
router.get('/recommendation', async (req, res, next) => {
  try {
    const { commodity, region } = req.query;
    if (!commodity || !region) {
      return res.status(400).json({ success: false, message: 'commodity and region required.' });
    }
    const rec = await getSaleRecommendation(commodity, region);
    res.json({ success: true, ...rec });
  } catch (err) { next(err); }
});

/**
 * GET /api/price/summary
 * Multi-commodity summary for admin dashboard (FR-24)
 */
router.get('/summary', async (req, res, next) => {
  try {
    // Latest mandi price per commodity across all regions
    const latest = await prisma.priceIndex.findMany({
      distinct: ['commodity'],
      orderBy: [{ commodity: 'asc' }, { date: 'desc' }],
      select: { commodity: true, variety: true, region: true, date: true, msp_price: true, mandi_price: true },
    });
    res.json({ success: true, summary: latest });
  } catch (err) { next(err); }
});

module.exports = { router, setRedis };
