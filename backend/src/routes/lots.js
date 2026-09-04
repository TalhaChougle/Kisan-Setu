// routes/lots.js
// Public lot browsing + offer management (farmer-side accept/reject/counter)
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');
const audit = require('../services/audit');
const notify = require('../services/mock-notify');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/lots
 * Public lot search (aggregated only — no farmer contact)
 */
router.get('/', async (req, res, next) => {
  try {
    const { commodity, district, grade, organic_flag, page = 1, limit = 20 } = req.query;
    const where = { status: 'ACTIVE' };
    if (commodity) where.commodity = { contains: commodity, mode: 'insensitive' };
    if (district)  where.district  = { contains: district,  mode: 'insensitive' };
    if (grade)     where.grade     = grade;
    if (organic_flag) where.organic_flag = organic_flag === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [lots, total] = await Promise.all([
      prisma.lot.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { created_at: 'desc' },
        select: {
          lot_id: true, commodity: true, variety: true, grade: true,
          quantity: true, asking_price: true, msp_at_listing: true,
          mandi_at_listing: true, organic_flag: true, district: true,
          state: true, season: true, status: true, created_at: true,
        },
      }),
      prisma.lot.count({ where }),
    ]);
    res.json({ success: true, lots, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

/**
 * GET /api/lots/:lotId
 * Public lot detail
 */
router.get('/:lotId', async (req, res, next) => {
  try {
    const lot = await prisma.lot.findUnique({
      where: { lot_id: req.params.lotId },
      include: {
        farmer: { select: { village: true, district: true } },
      },
    });
    if (!lot) return res.status(404).json({ success: false, message: 'Lot not found.' });
    res.json({ success: true, lot });
  } catch (err) { next(err); }
});

// ── Offer management — farmer side ────────────────────────────────────────

/**
 * GET /api/lots/:lotId/offers
 * Farmer sees all offers on their lot
 */
router.get('/:lotId/offers', authenticate, rbac('FARMER'), async (req, res, next) => {
  try {
    const lot = await prisma.lot.findFirst({ where: { lot_id: req.params.lotId, farmer_id: req.user.id } });
    if (!lot) return res.status(404).json({ success: false, message: 'Lot not found.' });

    const offers = await prisma.offer.findMany({
      where: { lot_id: req.params.lotId },
      orderBy: { timestamp: 'asc' },
      include: {
        buyer: { select: { name: true, business_proof_type: true, verification_status: true } },
        children: { include: { buyer: { select: { name: true } } } },
      },
    });
    res.json({ success: true, offers });
  } catch (err) { next(err); }
});

/**
 * PATCH /api/lots/:lotId/offers/:offerId/accept
 * Farmer accepts offer → triggers deal creation flow
 */
router.patch('/:lotId/offers/:offerId/accept', authenticate, rbac('FARMER'), async (req, res, next) => {
  try {
    const lot = await prisma.lot.findFirst({ where: { lot_id: req.params.lotId, farmer_id: req.user.id } });
    if (!lot) return res.status(404).json({ success: false, message: 'Lot not found.' });
    if (lot.status !== 'ACTIVE') return res.status(400).json({ success: false, message: 'Lot is not active.' });

    const offer = await prisma.offer.findFirst({ where: { offer_id: req.params.offerId, lot_id: req.params.lotId, status: 'PENDING' } });
    if (!offer) return res.status(404).json({ success: false, message: 'Pending offer not found.' });

    // Atomically: accept offer, reject all others, lock lot, create deal+escrow
    const commRate = parseFloat(process.env.COMMISSION_RATE || '0.025');
    const handoffDays = parseInt(process.env.HANDOFF_WINDOW_DAYS || '3');
    const totalAmount = offer.price * offer.quantity;
    const commAmount = totalAmount * commRate;
    const token = 'DEAL-' + uuidv4().split('-').slice(0, 2).join('').toUpperCase().slice(0, 10);

    const handoffStart = new Date();
    const handoffEnd = new Date();
    handoffEnd.setDate(handoffEnd.getDate() + handoffDays);

    const { holdEscrow } = require('../services/mock-payment');
    const escrowResult = await holdEscrow(offer.offer_id, totalAmount);

    const [updatedOffer, deal] = await prisma.$transaction([
      prisma.offer.update({ where: { offer_id: offer.offer_id }, data: { status: 'ACCEPTED' } }),
      prisma.offer.updateMany({
        where: { lot_id: req.params.lotId, offer_id: { not: offer.offer_id }, status: 'PENDING' },
        data: { status: 'REJECTED' },
      }),
      prisma.lot.update({ where: { lot_id: req.params.lotId }, data: { status: 'LOCKED' } }),
      prisma.deal.create({
        data: {
          deal_id: uuidv4(),
          lot_id: req.params.lotId,
          buyer_id: offer.buyer_id,
          farmer_id: req.user.id,
          final_price: offer.price,
          quantity: offer.quantity,
          total_amount: totalAmount,
          token,
          handoff_window_start: handoffStart,
          handoff_window_end: handoffEnd,
          status: 'CONFIRMED',
          export_eligible: lot.export_eligible,
        },
      }),
    ]);

    // Get deal (last item in transaction array doesn't work cleanly — fetch it)
    const newDeal = await prisma.deal.findFirst({ where: { lot_id: req.params.lotId, status: 'CONFIRMED' }, orderBy: { created_at: 'desc' } });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        transaction_id: uuidv4(),
        deal_id: newDeal.deal_id,
        amount: totalAmount,
        commission_rate: commRate,
        commission_amount: commAmount,
        farmer_payout: totalAmount - commAmount,
        escrow_status: 'HELD',
        payout_status: 'PENDING',
        gateway_ref: escrowResult.gatewayRef,
      },
    });

    await audit.log({ action: 'OFFER_ACCEPTED', entityType: 'Offer', entityId: offer.offer_id, actorId: req.user.id, actorType: 'FARMER', metadata: { final_price: offer.price, token } });
    await audit.log({ action: 'DEAL_CONFIRMED', entityType: 'Deal', entityId: newDeal.deal_id, actorId: req.user.id, actorType: 'FARMER', metadata: { token, total_amount: totalAmount } });
    await audit.log({ action: 'ESCROW_HELD', entityType: 'Transaction', entityId: newDeal.deal_id, actorId: req.user.id, actorType: 'FARMER', metadata: { amount: totalAmount } });

    // Notifications
    const farmer = await prisma.farmer.findUnique({ where: { farmer_id: req.user.id } });
    const buyer = await prisma.buyer.findUnique({ where: { buyer_id: offer.buyer_id } });
    notify.notifyOfferAccepted({ buyer, offer, lot }).catch(console.error);
    notify.notifyDealToken({ farmer, buyer, deal: newDeal, lot }).catch(console.error);

    res.json({ success: true, deal: newDeal, token: newDeal.token });
  } catch (err) { next(err); }
});

/**
 * PATCH /api/lots/:lotId/offers/:offerId/reject
 */
router.patch('/:lotId/offers/:offerId/reject', authenticate, rbac('FARMER'), async (req, res, next) => {
  try {
    const lot = await prisma.lot.findFirst({ where: { lot_id: req.params.lotId, farmer_id: req.user.id } });
    if (!lot) return res.status(404).json({ success: false, message: 'Lot not found.' });

    const offer = await prisma.offer.findFirst({ where: { offer_id: req.params.offerId, lot_id: req.params.lotId, status: 'PENDING' } });
    if (!offer) return res.status(404).json({ success: false, message: 'Pending offer not found.' });

    await prisma.offer.update({ where: { offer_id: offer.offer_id }, data: { status: 'REJECTED' } });
    await audit.log({ action: 'OFFER_REJECTED', entityType: 'Offer', entityId: offer.offer_id, actorId: req.user.id, actorType: 'FARMER', metadata: {} });

    const buyer = await prisma.buyer.findUnique({ where: { buyer_id: offer.buyer_id } });
    notify.notifyOfferRejected({ buyer, offer, lot }).catch(console.error);

    res.json({ success: true, message: 'Offer rejected.' });
  } catch (err) { next(err); }
});

/**
 * PATCH /api/lots/:lotId/offers/:offerId/counter
 * Farmer counters an offer
 */
router.patch('/:lotId/offers/:offerId/counter', authenticate, rbac('FARMER'), async (req, res, next) => {
  try {
    const { price, message } = req.body;
    if (!price) return res.status(400).json({ success: false, message: 'Counter price required.' });

    const lot = await prisma.lot.findFirst({ where: { lot_id: req.params.lotId, farmer_id: req.user.id } });
    if (!lot) return res.status(404).json({ success: false, message: 'Lot not found.' });

    const offer = await prisma.offer.findFirst({ where: { offer_id: req.params.offerId, lot_id: req.params.lotId, status: 'PENDING' } });
    if (!offer) return res.status(404).json({ success: false, message: 'Pending offer not found.' });

    const latestPrice = await prisma.priceIndex.findFirst({ where: { commodity: lot.commodity, region: lot.district || 'Pune' }, orderBy: { date: 'desc' } });

    // Mark original as countered, create new counter-offer
    await prisma.offer.update({ where: { offer_id: offer.offer_id }, data: { status: 'COUNTERED' } });
    const counter = await prisma.offer.create({
      data: {
        offer_id: uuidv4(),
        lot_id: req.params.lotId,
        buyer_id: offer.buyer_id,
        price: parseFloat(price),
        quantity: offer.quantity,
        message: message || null,
        status: 'PENDING',
        parent_id: offer.offer_id,
        msp_at_offer: latestPrice?.msp_price || null,
      },
    });

    await audit.log({ action: 'OFFER_COUNTERED', entityType: 'Offer', entityId: counter.offer_id, actorId: req.user.id, actorType: 'FARMER', metadata: { price, parent_id: offer.offer_id } });
    res.json({ success: true, counter_offer: counter });
  } catch (err) { next(err); }
});

/**
 * GET /api/lots/:lotId/logistics
 * Informational nearby transport/cold storage (FR-20)
 */
router.get('/:lotId/logistics', async (req, res, next) => {
  try {
    const lot = await prisma.lot.findUnique({ where: { lot_id: req.params.lotId } });
    if (!lot) return res.status(404).json({ success: false, message: 'Lot not found.' });

    const logistics = await prisma.logisticsOption.findMany({
      where: {
        OR: [
          { district: lot.district || '' },
          { commodities: { has: lot.commodity } },
        ],
      },
    });
    res.json({ success: true, logistics });
  } catch (err) { next(err); }
});

module.exports = router;
