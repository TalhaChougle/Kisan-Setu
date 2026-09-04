// routes/admin.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');

const router = express.Router();
const prisma = new PrismaClient();

// All admin routes require ADMIN role
router.use(authenticate, rbac('ADMIN'));

/**
 * GET /api/admin/dashboard
 * Main stats for the admin dashboard (FR-24)
 */
router.get('/dashboard', async (req, res, next) => {
  try {
    const [
      totalFarmers,
      totalBuyers,
      totalLots,
      activeLots,
      totalDeals,
      completedDeals,
      openDisputes,
      totalTransactionVolume,
      avgFarmerPrice,
    ] = await Promise.all([
      prisma.farmer.count(),
      prisma.buyer.count(),
      prisma.lot.count(),
      prisma.lot.count({ where: { status: 'ACTIVE' } }),
      prisma.deal.count(),
      prisma.deal.count({ where: { status: 'COMPLETED' } }),
      prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      prisma.transaction.aggregate({ _sum: { amount: true } }),
      prisma.deal.aggregate({ _avg: { final_price: true }, where: { status: 'COMPLETED' } }),
    ]);

    // MSP comparison — avg final price vs avg MSP at listing
    const deals = await prisma.deal.findMany({
      where: { status: 'COMPLETED' },
      include: { lot: { select: { msp_at_listing: true, mandi_at_listing: true, commodity: true } } },
    });

    const mspComparison = deals.reduce((acc, d) => {
      if (d.lot.msp_at_listing) {
        acc.totalFinalPrice += d.final_price;
        acc.totalMsp += d.lot.msp_at_listing;
        acc.count++;
      }
      return acc;
    }, { totalFinalPrice: 0, totalMsp: 0, count: 0 });

    const avgFinalVsMsp = mspComparison.count > 0
      ? ((mspComparison.totalFinalPrice / mspComparison.count) / (mspComparison.totalMsp / mspComparison.count) * 100 - 100).toFixed(2)
      : null;

    res.json({
      success: true,
      stats: {
        users: { farmers: totalFarmers, buyers: totalBuyers },
        lots:  { total: totalLots, active: activeLots },
        deals: { total: totalDeals, completed: completedDeals },
        disputes: { open: openDisputes },
        finance: {
          totalTransactionVolume: totalTransactionVolume._sum.amount || 0,
          avgFarmerRealisation: avgFarmerPrice._avg.final_price,
          avgFinalVsMspPct: avgFinalVsMsp ? `${avgFinalVsMsp}%` : 'N/A',
        },
      },
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/admin/transactions
 * All transactions with escrow status
 */
router.get('/transactions', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, escrow_status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = escrow_status ? { escrow_status } : {};

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { created_at: 'desc' },
        include: {
          deal: {
            include: {
              lot: { select: { commodity: true, variety: true, district: true } },
              farmer: { select: { name: true, mobile: true } },
              buyer: { select: { name: true, mobile: true } },
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({ success: true, transactions, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

/**
 * GET /api/admin/disputes
 * All disputes (FR-22)
 */
router.get('/disputes', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = status ? { status } : {};

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { created_at: 'desc' },
        include: {
          deal: {
            include: {
              lot: { select: { commodity: true, district: true } },
              farmer: { select: { name: true, mobile: true } },
              buyer: { select: { name: true, mobile: true } },
              transaction: { select: { amount: true, escrow_status: true } },
            },
          },
        },
      }),
      prisma.dispute.count({ where }),
    ]);

    res.json({ success: true, disputes, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

/**
 * GET /api/admin/farmers
 */
router.get('/farmers', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [farmers, total] = await Promise.all([
      prisma.farmer.findMany({
        skip,
        take: parseInt(limit),
        orderBy: { created_at: 'desc' },
        include: { _count: { select: { lots: true, deals: true } } },
      }),
      prisma.farmer.count(),
    ]);
    res.json({ success: true, farmers, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

/**
 * GET /api/admin/buyers
 */
router.get('/buyers', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, verification_status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = verification_status ? { verification_status } : {};

    const [buyers, total] = await Promise.all([
      prisma.buyer.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { created_at: 'desc' },
        include: { _count: { select: { offers: true, deals: true } } },
      }),
      prisma.buyer.count({ where }),
    ]);
    res.json({ success: true, buyers, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

/**
 * GET /api/admin/buyers/pending-verification
 * Buyers pending business proof review
 */
router.get('/buyers/pending-verification', async (req, res, next) => {
  try {
    const buyers = await prisma.buyer.findMany({
      where: { verification_status: 'PENDING', business_proof_url: { not: null } },
      orderBy: { created_at: 'asc' },
    });
    res.json({ success: true, buyers });
  } catch (err) { next(err); }
});

/**
 * PATCH /api/admin/buyers/:buyerId/verify
 * Admin manually verifies/rejects a buyer
 */
router.patch('/buyers/:buyerId/verify', async (req, res, next) => {
  try {
    const { action } = req.body; // 'approve' | 'reject'
    const status = action === 'approve' ? 'VERIFIED' : 'REJECTED';
    const buyer = await prisma.buyer.update({
      where: { buyer_id: req.params.buyerId },
      data: { verification_status: status, verified_at: new Date() },
    });
    res.json({ success: true, buyer });
  } catch (err) { next(err); }
});

/**
 * GET /api/admin/deals
 */
router.get('/deals', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = status ? { status } : {};

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { created_at: 'desc' },
        include: {
          lot: { select: { commodity: true, variety: true, district: true } },
          farmer: { select: { name: true, mobile: true } },
          buyer: { select: { name: true, mobile: true } },
          transaction: true,
          disputes: { select: { status: true, reason: true } },
        },
      }),
      prisma.deal.count({ where }),
    ]);
    res.json({ success: true, deals, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

/**
 * GET /api/admin/fraud-flags
 * Anomaly detection: buyers repeatedly undercutting MSP (FR-24)
 */
router.get('/fraud-flags', async (req, res, next) => {
  try {
    const MSP_UNDERCUT_THRESHOLD = 0.10; // flag if offer < 90% of MSP

    // Offers where price is significantly below MSP
    const suspiciousOffers = await prisma.offer.findMany({
      where: { msp_at_offer: { not: null } },
      include: {
        buyer: { select: { buyer_id: true, name: true, mobile: true } },
        lot: { select: { commodity: true, district: true } },
      },
    });

    const flagged = suspiciousOffers.filter(o =>
      o.msp_at_offer && o.price < o.msp_at_offer * (1 - MSP_UNDERCUT_THRESHOLD)
    );

    // Group by buyer
    const buyerFlags = flagged.reduce((acc, o) => {
      const key = o.buyer_id;
      if (!acc[key]) acc[key] = { buyer: o.buyer, count: 0, offers: [] };
      acc[key].count++;
      acc[key].offers.push({ offer_id: o.offer_id, price: o.price, msp: o.msp_at_offer, commodity: o.lot.commodity, district: o.lot.district });
      return acc;
    }, {});

    const result = Object.values(buyerFlags)
      .filter(b => b.count >= 2) // only flag repeat offenders
      .sort((a, b) => b.count - a.count);

    res.json({ success: true, flagged_buyers: result, threshold: `Offers < ${(1 - MSP_UNDERCUT_THRESHOLD) * 100}% of MSP` });
  } catch (err) { next(err); }
});

/**
 * GET /api/admin/audit-log
 */
router.get('/audit-log', async (req, res, next) => {
  try {
    const { entity_id, action, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (entity_id) where.entity_id = entity_id;
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, skip, take: parseInt(limit), orderBy: { created_at: 'desc' } }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ success: true, logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

/**
 * GET /api/admin/regional-prices
 * Regional price trends for dashboard chart
 */
router.get('/regional-prices', async (req, res, next) => {
  try {
    const { commodity = 'Wheat', days = '30' } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));
    since.setHours(0, 0, 0, 0);

    const prices = await prisma.priceIndex.findMany({
      where: { commodity, date: { gte: since } },
      orderBy: [{ region: 'asc' }, { date: 'asc' }],
      select: { region: true, date: true, msp_price: true, mandi_price: true },
    });

    // Group by region
    const grouped = prices.reduce((acc, p) => {
      if (!acc[p.region]) acc[p.region] = [];
      acc[p.region].push({ date: p.date, msp_price: p.msp_price, mandi_price: p.mandi_price });
      return acc;
    }, {});

    res.json({ success: true, commodity, days: parseInt(days), regions: grouped });
  } catch (err) { next(err); }
});

/**
 * GET /api/admin/lots/flagged
 * Deals that exceeded handoff window without confirmation
 */
router.get('/deals/flagged', async (req, res, next) => {
  try {
    const flagged = await prisma.deal.findMany({
      where: { status: { in: ['FLAGGED', 'DISPUTED'] } },
      orderBy: { created_at: 'desc' },
      include: {
        lot: { select: { commodity: true, district: true } },
        farmer: { select: { name: true, mobile: true } },
        buyer: { select: { name: true, mobile: true } },
        transaction: { select: { amount: true, escrow_status: true } },
      },
    });
    res.json({ success: true, flagged });
  } catch (err) { next(err); }
});

module.exports = router;
