// routes/farmers.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');
const { validate, schemas } = require('../middleware/validate');
const { verifyAadhaar } = require('../services/mock-ekyc');
const audit = require('../services/audit');

const router = express.Router();
const prisma = new PrismaClient();

// All routes require FARMER auth
router.use(authenticate, rbac('FARMER'));

/**
 * GET /api/farmers/profile
 */
router.get('/profile', async (req, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { farmer_id: req.user.id } });
    if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found.' });
    res.json({ success: true, farmer });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/farmers/profile
 */
router.put('/profile', async (req, res, next) => {
  try {
    const { name, village, district, language_pref } = req.body;
    const farmer = await prisma.farmer.update({
      where: { farmer_id: req.user.id },
      data: {
        ...(name && { name }),
        ...(village !== undefined && { village }),
        ...(district !== undefined && { district }),
        ...(language_pref && { language_pref }),
      },
    });
    res.json({ success: true, farmer });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/farmers/kyc
 * Aadhaar e-KYC — never stores raw Aadhaar number
 */
router.post('/kyc', validate(schemas.kyc), async (req, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { farmer_id: req.user.id } });
    if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found.' });

    if (farmer.aadhaar_verified) {
      return res.json({ success: true, message: 'Aadhaar already verified.', aadhaar_verified: true });
    }

    const { aadhaar_number } = req.body;
    // IMPORTANT: aadhaar_number is used only for verification, NEVER persisted
    const result = await verifyAadhaar(aadhaar_number, farmer.mobile);

    if (!result.verified) {
      return res.status(400).json({ success: false, message: result.message });
    }

    const updated = await prisma.farmer.update({
      where: { farmer_id: req.user.id },
      data: { aadhaar_verified: true, aadhaar_verified_at: new Date() },
    });

    await audit.log({
      action: 'USER_KYC_VERIFIED',
      entityType: 'Farmer',
      entityId: req.user.id,
      actorId: req.user.id,
      actorType: 'FARMER',
      metadata: { aadhaar_verified: true, verified_at: new Date() },
    });

    res.json({ success: true, message: result.message, aadhaar_verified: true, verified_at: updated.aadhaar_verified_at });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/farmers/lots
 * All lots for the authenticated farmer
 */
router.get('/lots', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [lots, total] = await Promise.all([
      prisma.lot.findMany({
        where: { farmer_id: req.user.id },
        orderBy: { created_at: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          offers: { where: { status: 'PENDING' }, select: { offer_id: true, price: true, buyer_id: true } },
          deal: { select: { deal_id: true, status: true, token: true } },
        },
      }),
      prisma.lot.count({ where: { farmer_id: req.user.id } }),
    ]);

    res.json({ success: true, lots, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/farmers/lots
 * Create a new lot
 */
router.post('/lots', validate(schemas.createLot), async (req, res, next) => {
  try {
    const farmer = await prisma.farmer.findUnique({ where: { farmer_id: req.user.id } });
    if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found.' });
    if (!farmer.aadhaar_verified) {
      return res.status(403).json({ success: false, message: 'Aadhaar e-KYC required before listing lots.' });
    }

    const { commodity, variety, grade, quantity, photo_url, location, village, district, season, harvest_date, organic_flag, asking_price } = req.body;

    // Fetch current MSP/mandi price to snapshot at listing time
    const latestPrice = await prisma.priceIndex.findFirst({
      where: { commodity, region: district || farmer.district || 'Pune' },
      orderBy: { date: 'desc' },
    });

    const lot = await prisma.lot.create({
      data: {
        lot_id: uuidv4(),
        farmer_id: req.user.id,
        commodity,
        variety: variety || null,
        grade,
        quantity,
        photo_url: photo_url || null,
        location: location || farmer.location || '',
        village: village || farmer.village || '',
        district: district || farmer.district || '',
        state: 'Maharashtra',
        season,
        harvest_date: harvest_date ? new Date(harvest_date) : null,
        organic_flag: organic_flag || false,
        asking_price,
        msp_at_listing: latestPrice?.msp_price || null,
        mandi_at_listing: latestPrice?.mandi_price || null,
        export_eligible: organic_flag || false,
        status: 'ACTIVE',
      },
    });

    await audit.log({
      action: 'LOT_CREATED',
      entityType: 'Lot',
      entityId: lot.lot_id,
      actorId: req.user.id,
      actorType: 'FARMER',
      metadata: { commodity, asking_price, msp_at_listing: lot.msp_at_listing, mandi_at_listing: lot.mandi_at_listing },
    });

    // Fire-and-forget notification
    const { notifyListingConfirmed } = require('../services/mock-notify');
    notifyListingConfirmed({ farmer, lot }).catch(console.error);

    res.status(201).json({ success: true, lot });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/farmers/lots/:lotId
 */
router.get('/lots/:lotId', async (req, res, next) => {
  try {
    const lot = await prisma.lot.findFirst({
      where: { lot_id: req.params.lotId, farmer_id: req.user.id },
      include: {
        offers: {
          include: { buyer: { select: { name: true, business_proof_type: true, verification_status: true } } },
          orderBy: { timestamp: 'asc' },
        },
        deal: true,
      },
    });
    if (!lot) return res.status(404).json({ success: false, message: 'Lot not found.' });
    res.json({ success: true, lot });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/farmers/lots/:lotId
 * Update lot (only if ACTIVE)
 */
router.put('/lots/:lotId', validate(schemas.updateLot), async (req, res, next) => {
  try {
    const lot = await prisma.lot.findFirst({ where: { lot_id: req.params.lotId, farmer_id: req.user.id } });
    if (!lot) return res.status(404).json({ success: false, message: 'Lot not found.' });
    if (lot.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Only ACTIVE lots can be edited.' });
    }

    const { quantity, asking_price, grade, organic_flag, photo_url } = req.body;
    const updated = await prisma.lot.update({
      where: { lot_id: req.params.lotId },
      data: {
        ...(quantity !== undefined && { quantity }),
        ...(asking_price !== undefined && { asking_price }),
        ...(grade && { grade }),
        ...(organic_flag !== undefined && { organic_flag }),
        ...(photo_url && { photo_url }),
      },
    });

    await audit.log({
      action: 'LOT_UPDATED',
      entityType: 'Lot',
      entityId: lot.lot_id,
      actorId: req.user.id,
      actorType: 'FARMER',
      metadata: req.body,
    });

    res.json({ success: true, lot: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/farmers/lots/:lotId
 * Withdraw a lot (set status to WITHDRAWN)
 */
router.delete('/lots/:lotId', async (req, res, next) => {
  try {
    const lot = await prisma.lot.findFirst({ where: { lot_id: req.params.lotId, farmer_id: req.user.id } });
    if (!lot) return res.status(404).json({ success: false, message: 'Lot not found.' });
    if (!['ACTIVE'].includes(lot.status)) {
      return res.status(400).json({ success: false, message: 'Only ACTIVE lots can be withdrawn.' });
    }

    await prisma.lot.update({ where: { lot_id: req.params.lotId }, data: { status: 'WITHDRAWN' } });

    await audit.log({
      action: 'LOT_WITHDRAWN',
      entityType: 'Lot',
      entityId: lot.lot_id,
      actorId: req.user.id,
      actorType: 'FARMER',
      metadata: {},
    });

    res.json({ success: true, message: 'Lot withdrawn successfully.' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/farmers/notifications
 */
router.get('/notifications', async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { user_id: req.user.id, user_type: 'FARMER' },
      orderBy: { sent_at: 'desc' },
      take: 50,
    });
    res.json({ success: true, notifications });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
