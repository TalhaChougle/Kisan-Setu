// services/price-ingestion.js
// ── Price Ingestion Service ────────────────────────────────────────────────
// Simulates Agmarknet / eNAM price data ingestion via node-cron.
// Runs daily at midnight to insert today's mock mandi prices.

const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

const COMMODITY_CONFIGS = [
  { commodity: 'Wheat',   variety: 'HD-2967',      basePrice: 2200, mspPrice: 2275, regions: ['Pune', 'Nashik', 'Aurangabad'] },
  { commodity: 'Onion',   variety: 'Nasik Red',    basePrice: 1800, mspPrice: null, regions: ['Nashik', 'Pune', 'Ahmednagar'] },
  { commodity: 'Soybean', variety: 'JS-335',       basePrice: 4200, mspPrice: 4600, regions: ['Aurangabad', 'Latur', 'Osmanabad'] },
  { commodity: 'Cotton',  variety: 'Bt Cotton',    basePrice: 6800, mspPrice: 7020, regions: ['Aurangabad', 'Nashik', 'Amravati'] },
  { commodity: 'Rice',    variety: 'Basmati 1121', basePrice: 3400, mspPrice: 2183, regions: ['Pune', 'Raigad', 'Sindhudurg'] },
];

function randomisedPrice(base) {
  const variation = base * 0.04 * (Math.random() - 0.5); // ±2% daily variation
  return Math.round((base + variation) * 100) / 100;
}

/**
 * Ingest today's mock price data for all commodity-region pairs.
 */
async function ingestTodayPrices() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let inserted = 0;
  let skipped = 0;

  for (const cfg of COMMODITY_CONFIGS) {
    for (const region of cfg.regions) {
      try {
        await prisma.priceIndex.upsert({
          where: {
            commodity_region_date_variety: {
              commodity: cfg.commodity,
              region,
              date: today,
              variety: cfg.variety || null,
            },
          },
          update: {
            mandi_price: randomisedPrice(cfg.basePrice),
          },
          create: {
            price_id: uuidv4(),
            commodity: cfg.commodity,
            variety: cfg.variety || null,
            region,
            state: 'Maharashtra',
            date: today,
            msp_price: cfg.mspPrice,
            mandi_price: randomisedPrice(cfg.basePrice),
            source: 'mock_agmarknet_cron',
          },
        });
        inserted++;
      } catch (e) {
        console.error(`[PRICE INGESTION] Error for ${cfg.commodity}/${region}:`, e.message);
        skipped++;
      }
    }
  }

  console.log(`[PRICE INGESTION] ${new Date().toISOString()} — Inserted/updated: ${inserted}, Skipped: ${skipped}`);
}

/**
 * Get latest price for a commodity in a region (with Redis caching).
 */
async function getLatestPrice(commodity, region, redisClient) {
  const cacheKey = `price:${commodity}:${region}`;

  if (redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      // Redis unavailable — fall through to DB
    }
  }

  const price = await prisma.priceIndex.findFirst({
    where: { commodity, region },
    orderBy: { date: 'desc' },
  });

  if (price && redisClient) {
    try {
      await redisClient.setex(cacheKey, 3600, JSON.stringify(price)); // cache 1 hour
    } catch (e) { /* ignore */ }
  }

  return price;
}

/**
 * Get price trend for a commodity-region pair over N days.
 * Returns array of { date, msp_price, mandi_price } sorted ascending.
 */
async function getPriceTrend(commodity, region, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  return prisma.priceIndex.findMany({
    where: {
      commodity,
      region,
      date: { gte: since },
    },
    orderBy: { date: 'asc' },
    select: { date: true, msp_price: true, mandi_price: true },
  });
}

/**
 * Sale-window recommendation based on recent price trend.
 * Compares average of last 7 days vs average of 7 days before that.
 * @returns {{ recommendation: string, trend: 'UP'|'DOWN'|'STABLE' }}
 */
async function getSaleRecommendation(commodity, region) {
  const trend = await getPriceTrend(commodity, region, 14);

  if (trend.length < 7) {
    return { recommendation: 'Insufficient price data for recommendation.', trend: 'STABLE' };
  }

  const recent7  = trend.slice(-7).map(p => p.mandi_price);
  const older7   = trend.slice(0, 7).map(p => p.mandi_price);

  const avgRecent = recent7.reduce((a, b) => a + b, 0) / recent7.length;
  const avgOlder  = older7.reduce((a, b) => a + b, 0) / older7.length;
  const changePct = ((avgRecent - avgOlder) / avgOlder) * 100;

  if (changePct > 3) {
    return {
      trend: 'UP',
      changePct: changePct.toFixed(1),
      recommendation: `Prices for ${commodity} in ${region} are trending UP (+${changePct.toFixed(1)}%). Consider holding for a better price.`,
    };
  } else if (changePct < -3) {
    return {
      trend: 'DOWN',
      changePct: changePct.toFixed(1),
      recommendation: `Prices for ${commodity} in ${region} are trending DOWN (${changePct.toFixed(1)}%). Good time to sell now before further decline.`,
    };
  } else {
    // Check if near seasonal peak (price within 2% of 90-day high)
    const allPrices = await getPriceTrend(commodity, region, 90);
    const max90 = Math.max(...allPrices.map(p => p.mandi_price));
    const latestPrice = recent7[recent7.length - 1];

    if (latestPrice >= max90 * 0.98) {
      return {
        trend: 'STABLE',
        changePct: changePct.toFixed(1),
        recommendation: `${commodity} is at or near its seasonal peak in ${region}. This is a good time to sell.`,
      };
    }

    return {
      trend: 'STABLE',
      changePct: changePct.toFixed(1),
      recommendation: `${commodity} prices in ${region} are stable. Standard market conditions apply.`,
    };
  }
}

/**
 * Start the daily price ingestion cron job.
 * Runs every day at 00:05 IST.
 */
function startPriceCron() {
  console.log('[PRICE CRON] Scheduling daily price ingestion at 00:05...');
  cron.schedule('5 0 * * *', async () => {
    console.log('[PRICE CRON] Running price ingestion job...');
    await ingestTodayPrices();
  }, { timezone: 'Asia/Kolkata' });

  // Also run once on startup to fill today's data if missing
  ingestTodayPrices().catch(console.error);
}

module.exports = { startPriceCron, ingestTodayPrices, getLatestPrice, getPriceTrend, getSaleRecommendation };
