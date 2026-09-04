// routes/buyers.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');
const { validate, schemas } = require('../middleware/validate');
const { verifyAadhaar } = require('../services/mock-ekyc');
const audit = require('../services/audit');
const notify = require('../services/mock-notify');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate, rbac('BUYER'));

/**
 * GET /api/buyers/profile
 */
router.get('/profile', async (req, res, next) => {
  try {
    const buyer = await prisma.buyer.findUnique({ where: { buyer_id: req.user.id } });
    if (!buyer) return res.status(404).json({ success: false, message: 'Buyer not found.' });
    res.json({ success: true, buyer });
  } catch (err) { next(err); }
});

/**
 * PUT /api/buyers/profile
 */
router.put('/profile', async (req, res, next) => {
  try {
    const { name } = req.body;
    const buyer = await prisma.buyer.update({
      where: { buyer_id: req.user.id },
      data: { ...(name && { name }) },
    });
    res.json({ success: true, buyer });
  } catch (err) { next(err); }
});

/**
 * POST /api/buyers/kyc
 * Aadhaar e-KYC — never stores raw Aadhaar data
 */
router.post('/kyc', validate(schemas.kyc), async (req, res, next) => {
  try {
    const buyer = await prisma.buyer.findUnique({ where: { buyer_id: req.user.id } });
    if (!buyer) return res.status(404).json({ success: false, message: 'Buyer not found.' });
    if (buyer.aadhaar_verified) return res.json({ success: true, message: 'Already verified.', aadhaar_verified: true });

    const result = await verifyAadhaar(req.body.aadhaar_number, buyer.mobile);
    if (!result.verified) return res.status(400).json({ success: false, message: result.message });

    const updated = await prisma.buyer.update({
      where: { buyer_id: req.user.id },
      data: { aadhaar_verified: true, aadhaar_verified_at: new Date() },
    });

    await audit.log({ action: 'USER_KYC_VERIFIED', entityType: 'Buyer', entityId: req.user.id, actorId: req.user.id, actorType: 'BUYER', metadata: { aadhaar_verified: true } });
    res.json({ success: true, message: result.message, aadhaar_verified: true, verified_at: updated.aadhaar_verified_at });
  } catch (err) { next(err); }
});

/**
 * POST /api/buyers/business-proof
 * Upload business proof and request verification
 */
router.post('/business-proof', validate(schemas.businessProof), async (req, res, next) => {
  try {
    const buyer = await prisma.buyer.findUnique({ where: { buyer_id: req.user.id } });
    if (!buyer) return res.status(404).json({ success: false, message: 'Buyer not found.' });
    if (!buyer.aadhaar_verified) return res.status(403).json({ success: false, message: 'Complete Aadhaar e-KYC first.' });

    const { business_proof_type, business_proof_url } = req.body;
    const updated = await prisma.buyer.update({
      where: { buyer_id: req.user.id },
      data: {
        business_proof_type,
        business_proof_url,
        verification_status: 'PENDING',
        // Auto-verify in mock (in production an admin reviews)
        // For MVP: auto-approve after proof submission
        verified_at: new Date(),
      },
    });

    // Mock: auto-verify immediately in dev
    const verified = await prisma.buyer.update({
      where: { buyer_id: req.user.id },
      data: { verification_status: 'VERIFIED', verified_at: new Date(), export_eligible: business_proof_type === 'EXPORT_LICENCE' },
    });

    await audit.log({ action: 'USER_BUSINESS_VERIFIED', entityType: 'Buyer', entityId: req.user.id, actorId: req.user.id, actorType: 'BUYER', metadata: { business_proof_type } });

    res.json({ success: true, message: 'Business proof submitted and verified (mock auto-approval).', buyer: verified });
  } catch (err) { next(err); }
});

/**
 * GET /api/buyers/lots/search
 * Search/filter lots (verified buyers only see full details)
 * FR-4: Unverified buyers can view aggregated price-trend data only
 */
router.get('/lots/search', async (req, res, next) => {
  try {
    const isVerified = req.user.verified || false;
    const raw = req.query;

    const where = { status: 'ACTIVE' };
    if (raw.commodity) where.commodity = { contains: raw.commodity, mode: 'insensitive' };
    if (raw.variety)   where.variety   = { contains: raw.variety,   mode: 'insensitive' };
    if (raw.grade)     where.grade     = raw.grade;
    if (raw.district)  where.district  = { contains: raw.district,  mode: 'insensitive' };
    if (raw.organic_flag) where.organic_flag = raw.organic_flag === 'true';
    if (raw.season)    where.season    = raw.season;
    if (raw.min_price || raw.max_price) {
      where.asking_price = {};
      if (raw.min_price) where.asking_price.gte = parseFloat(raw.min_price);
      if (raw.max_price) where.asking_price.lte = parseFloat(raw.max_price);
    }
    if (raw.min_quantity || raw.max_quantity) {
      where.quantity = {};
      if (raw.min_quantity) where.quantity.gte = parseFloat(raw.min_quantity);
      if (raw.max_quantity) where.quantity.lte = parseFloat(raw.max_quantity);
    }

    const page  = Math.max(1, parseInt(raw.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(raw.limit) || 20));
    const skip  = (page - 1) * limit;

    const [lots, total] = await Promise.all([
      prisma.lot.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          farmer: isVerified
            ? { select: { name: true, village: true, district: true, mobile: true } }
            : { select: { village: true, district: true } },
        },
      }),
      prisma.lot.count({ where }),
    ]);

    // Unverified buyers: mask farmer contact details (FR-4)
    const sanitised = lots.map(lot => ({
      ...lot,
      farmer: isVerified ? lot.farmer : { district: lot.farmer?.district, village: lot.farmer?.village },
    }));

    res.json({ success: true, lots: sanitised, total, page, limit, isVerified });
  } catch (err) { next(err); }
});

/**
 * GET /api/buyers/lots/:lotId
 */
router.get('/lots/:lotId', async (req, res, next) => {
  try {
    const isVerified = req.user.verified || false;
    const lot = await prisma.lot.findUnique({
      where: { lot_id: req.params.lotId },
      include: {
        farmer: isVerified
          ? { select: { name: true, village: true, district: true, mobile: true } }
          : { select: { village: true, district: true } },
        offers: {
          where: { buyer_id: req.user.id },
          orderBy: { timestamp: 'asc' },
          include: { children: true },
        },
      },
    });
    if (!lot) return res.status(404).json({ success: false, message: 'Lot not found.' });
    res.json({ success: true, lot });
  } catch (err) { next(err); }
});

/**
 * POST /api/buyers/lots/:lotId/offers
 * Create an offer (verified buyers only)
 */
router.post('/lots/:lotId/offers', async (req, res, next) => {
  try {
    const buyer = await prisma.buyer.findUnique({ where: { buyer_id: req.user.id } });
    if (!buyer || buyer.verification_status !== 'VERIFIED') {
      return res.status(403).json({ success: false, message: 'Business verification required to make offers (FR-4).' });
    }

    const lot = await prisma.lot.findUnique({ where: { lot_id: req.params.lotId } });
    if (!lot) return res.status(404).json({ success: false, message: 'Lot not found.' });
    if (lot.status !== 'ACTIVE') return res.status(400).json({ success: false, message: 'Lot is not available for offers.' });

    // Check no existing pending offer from this buyer
    const existingOffer = await prisma.offer.findFirst({
      where: { lot_id: req.params.lotId, buyer_id: req.user.id, status: 'PENDING' },
    });
    if (existingOffer) return res.status(409).json({ success: false, message: 'You already have a pending offer on this lot. Counter or wait for response.' });

    const { price, quantity, message } = req.body;
    if (!price) return res.status(400).json({ success: false, message: 'Price is required.' });

    // Fetch current MSP to snapshot
    const latestPrice = await prisma.priceIndex.findFirst({
      where: { commodity: lot.commodity, region: lot.district || 'Pune' },
      orderBy: { date: 'desc' },
    });

    const offer = await prisma.offer.create({
      data: {
        offer_id: uuidv4(),
        lot_id: req.params.lotId,
        buyer_id: req.user.id,
        price: parseFloat(price),
        quantity: quantity ? parseFloat(quantity) : lot.quantity,
        message: message || null,
        status: 'PENDING',
        msp_at_offer: latestPrice?.msp_price || null,
      },
    });

    await audit.log({ action: 'OFFER_CREATED', entityType: 'Offer', entityId: offer.offer_id, actorId: req.user.id, actorType: 'BUYER', metadata: { price, lot_id: req.params.lotId, msp_at_offer: offer.msp_at_offer } });

    // Notify farmer
    const farmer = await prisma.farmer.findUnique({ where: { farmer_id: lot.farmer_id } });
    notify.notifyNewOffer({ farmer, offer, lot, buyerName: buyer.name }).catch(console.error);

    res.status(201).json({ success: true, offer });
  } catch (err) { next(err); }
});

/**
 * GET /api/buyers/offers
 * All offers made by this buyer
 */
router.get('/offers', async (req, res, next) => {
  try {
    const offers = await prisma.offer.findMany({
      where: { buyer_id: req.user.id },
      orderBy: { timestamp: 'desc' },
      include: {
        lot: { select: { lot_id: true, commodity: true, variety: true, grade: true, quantity: true, asking_price: true, status: true, district: true } },
      },
    });
    res.json({ success: true, offers });
  } catch (err) { next(err); }
});

/**
 * GET /api/buyers/deals
 */
router.get('/deals', async (req, res, next) => {
  try {
    const deals = await prisma.deal.findMany({
      where: { buyer_id: req.user.id },
      orderBy: { created_at: 'desc' },
      include: {
        lot: { select: { commodity: true, variety: true, grade: true, district: true } },
        farmer: { select: { name: true, mobile: true, village: true } },
        transaction: true,
        disputes: true,
      },
    });
    res.json({ success: true, deals });
  } catch (err) { next(err); }
});

/**
 * GET /api/buyers/notifications
 */
router.get('/notifications', async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { user_id: req.user.id, user_type: 'BUYER' },
      orderBy: { sent_at: 'desc' },
      take: 50,
    });
    res.json({ success: true, notifications });
  } catch (err) { next(err); }
});

module.exports = router;
