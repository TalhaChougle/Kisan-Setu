// routes/deals.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const audit = require('../services/audit');
const notify = require('../services/mock-notify');
const { releaseEscrow } = require('../services/mock-payment');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

/**
 * GET /api/deals/:dealId
 * Get deal detail — accessible by farmer or buyer party to the deal
 */
router.get('/:dealId', async (req, res, next) => {
  try {
    const deal = await prisma.deal.findUnique({
      where: { deal_id: req.params.dealId },
      include: {
        lot: true,
        farmer: { select: { name: true, mobile: true, village: true, district: true } },
        buyer: { select: { name: true, mobile: true, business_proof_type: true } },
        transaction: true,
        disputes: true,
      },
    });
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found.' });

    // Only parties to the deal (or admin) can view
    const { id, role } = req.user;
    if (role !== 'ADMIN' && deal.farmer_id !== id && deal.buyer_id !== id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    res.json({ success: true, deal });
  } catch (err) { next(err); }
});

/**
 * POST /api/deals/:dealId/confirm-handoff
 * Either party confirms physical handoff.
 * Both sides must confirm to trigger escrow release.
 */
router.post('/:dealId/confirm-handoff', validate(schemas.confirmHandoff), async (req, res, next) => {
  try {
    const deal = await prisma.deal.findUnique({
      where: { deal_id: req.params.dealId },
      include: { transaction: true, lot: true, farmer: true, buyer: true },
    });
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found.' });

    const { id, role } = req.user;
    const isFarmer = role === 'FARMER' && deal.farmer_id === id;
    const isBuyer  = role === 'BUYER'  && deal.buyer_id  === id;
    if (!isFarmer && !isBuyer) return res.status(403).json({ success: false, message: 'Not a party to this deal.' });

    if (!['CONFIRMED', 'FARMER_CONFIRMED', 'BUYER_CONFIRMED'].includes(deal.status)) {
      return res.status(400).json({ success: false, message: `Cannot confirm handoff — deal status is ${deal.status}` });
    }

    // Check window
    const now = new Date();
    if (now > deal.handoff_window_end) {
      // Auto-flag overdue deals
      await prisma.deal.update({ where: { deal_id: deal.deal_id }, data: { status: 'FLAGGED' } });
      await audit.log({ action: 'DEAL_FLAGGED', entityType: 'Deal', entityId: deal.deal_id, actorId: id, actorType: role, metadata: { reason: 'Handoff window expired' } });
      return res.status(400).json({ success: false, message: 'Handoff window has expired. Deal flagged for admin review.' });
    }

    const { confirmed_quantity, confirmed_grade } = req.body;
    let updateData = { confirmed_quantity, confirmed_grade };
    let newStatus = deal.status;
    let action;

    if (isFarmer && !deal.farmer_confirmed_at) {
      updateData.farmer_confirmed_at = now;
      newStatus = deal.buyer_confirmed_at ? 'COMPLETED' : 'FARMER_CONFIRMED';
      action = deal.buyer_confirmed_at ? 'DEAL_COMPLETED' : 'DEAL_FARMER_CONFIRMED';
    } else if (isBuyer && !deal.buyer_confirmed_at) {
      updateData.buyer_confirmed_at = now;
      newStatus = deal.farmer_confirmed_at ? 'COMPLETED' : 'BUYER_CONFIRMED';
      action = deal.farmer_confirmed_at ? 'DEAL_COMPLETED' : 'DEAL_BUYER_CONFIRMED';
    } else {
      return res.status(409).json({ success: false, message: 'You have already confirmed handoff.' });
    }

    updateData.status = newStatus;
    const updated = await prisma.deal.update({ where: { deal_id: deal.deal_id }, data: updateData });

    await audit.log({ action, entityType: 'Deal', entityId: deal.deal_id, actorId: id, actorType: role, metadata: { confirmed_quantity, confirmed_grade, status: newStatus } });

    // If both sides confirmed → release escrow
    if (newStatus === 'COMPLETED' && deal.transaction) {
      const tx = deal.transaction;
      const escrowResult = await releaseEscrow(tx.gateway_ref, tx.farmer_payout, tx.commission_amount);

      await prisma.transaction.update({
        where: { transaction_id: tx.transaction_id },
        data: { escrow_status: 'RELEASED', payout_status: 'PAID', released_at: now },
      });

      await audit.log({ action: 'ESCROW_RELEASED', entityType: 'Transaction', entityId: deal.deal_id, actorId: id, actorType: role, metadata: { farmer_payout: tx.farmer_payout, commission: tx.commission_amount } });

      notify.notifyPaymentReleased({ farmer: deal.farmer, deal, transaction: { ...tx, farmer_payout: tx.farmer_payout } }).catch(console.error);

      return res.json({
        success: true,
        message: 'Both parties confirmed. Escrow released to farmer.',
        deal: updated,
        escrow: escrowResult.message,
      });
    }

    res.json({ success: true, message: `Handoff confirmed by ${role}. Waiting for the other party.`, deal: updated });
  } catch (err) { next(err); }
});

/**
 * GET /api/deals/:dealId/token
 * Get deal token (only parties to the deal)
 */
router.get('/:dealId/token', async (req, res, next) => {
  try {
    const deal = await prisma.deal.findUnique({ where: { deal_id: req.params.dealId } });
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found.' });
    const { id, role } = req.user;
    if (role !== 'ADMIN' && deal.farmer_id !== id && deal.buyer_id !== id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    res.json({ success: true, token: deal.token, status: deal.status, handoff_window_end: deal.handoff_window_end });
  } catch (err) { next(err); }
});

module.exports = router;
