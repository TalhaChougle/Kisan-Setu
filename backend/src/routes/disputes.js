// routes/disputes.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const { rbac } = require('../middleware/rbac');
const { validate, schemas } = require('../middleware/validate');
const audit = require('../services/audit');
const notify = require('../services/mock-notify');
const { refundEscrow, releaseEscrow } = require('../services/mock-payment');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticate);

/**
 * POST /api/disputes
 * Raise a dispute on a deal (FR-21)
 */
router.post('/', validate(schemas.raiseDispute), async (req, res, next) => {
  try {
    const { deal_id, reason, description, evidence_url } = req.body;
    if (!deal_id) return res.status(400).json({ success: false, message: 'deal_id is required.' });

    const deal = await prisma.deal.findUnique({
      where: { deal_id },
      include: { transaction: true, farmer: true, buyer: true },
    });
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found.' });

    const { id, role } = req.user;
    if (deal.farmer_id !== id && deal.buyer_id !== id) {
      return res.status(403).json({ success: false, message: 'Not a party to this deal.' });
    }
    if (!['CONFIRMED', 'FARMER_CONFIRMED', 'BUYER_CONFIRMED', 'COMPLETED'].includes(deal.status)) {
      return res.status(400).json({ success: false, message: 'Disputes can only be raised on active/confirmed deals.' });
    }

    // Check no open dispute already exists
    const existing = await prisma.dispute.findFirst({ where: { deal_id, status: { in: ['OPEN', 'UNDER_REVIEW'] } } });
    if (existing) return res.status(409).json({ success: false, message: 'An open dispute already exists for this deal.' });

    // Freeze escrow (mark deal as DISPUTED)
    await prisma.deal.update({ where: { deal_id }, data: { status: 'DISPUTED' } });

    const dispute = await prisma.dispute.create({
      data: {
        dispute_id: uuidv4(),
        deal_id,
        raised_by: id,
        raised_by_type: role,
        reason,
        description: description || null,
        evidence_url: evidence_url || null,
        status: 'OPEN',
      },
    });

    await audit.log({ action: 'DISPUTE_RAISED', entityType: 'Dispute', entityId: dispute.dispute_id, actorId: id, actorType: role, metadata: { reason, deal_id } });

    // Notify both parties
    notify.notifyDisputeRaised({ farmer: deal.farmer, buyer: deal.buyer, dispute, deal }).catch(console.error);

    res.status(201).json({ success: true, dispute, message: 'Dispute raised. Escrow frozen pending admin review.' });
  } catch (err) { next(err); }
});

/**
 * GET /api/disputes/:disputeId
 */
router.get('/:disputeId', async (req, res, next) => {
  try {
    const dispute = await prisma.dispute.findUnique({
      where: { dispute_id: req.params.disputeId },
      include: { deal: { include: { lot: true, farmer: true, buyer: true, transaction: true } } },
    });
    if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found.' });

    const { id, role } = req.user;
    if (role !== 'ADMIN' && dispute.deal.farmer_id !== id && dispute.deal.buyer_id !== id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    res.json({ success: true, dispute });
  } catch (err) { next(err); }
});

/**
 * GET /api/disputes
 * User's own disputes
 */
router.get('/', async (req, res, next) => {
  try {
    const { id, role } = req.user;
    const disputes = await prisma.dispute.findMany({
      where: {
        OR: [
          { raised_by: id },
          { deal: role === 'FARMER' ? { farmer_id: id } : { buyer_id: id } },
        ],
      },
      orderBy: { created_at: 'desc' },
      include: { deal: { select: { token: true, status: true } } },
    });
    res.json({ success: true, disputes });
  } catch (err) { next(err); }
});

/**
 * PATCH /api/disputes/:disputeId/resolve
 * Admin resolves a dispute (FR-22)
 */
router.patch('/:disputeId/resolve', rbac('ADMIN'), validate(schemas.resolveDispute), async (req, res, next) => {
  try {
    const { resolution, action } = req.body;

    const dispute = await prisma.dispute.findUnique({
      where: { dispute_id: req.params.disputeId },
      include: { deal: { include: { transaction: true, farmer: true, buyer: true } } },
    });
    if (!dispute) return res.status(404).json({ success: false, message: 'Dispute not found.' });
    if (dispute.status === 'RESOLVED') return res.status(400).json({ success: false, message: 'Dispute already resolved.' });

    const tx = dispute.deal.transaction;
    let escrowResult;

    // Handle escrow based on resolution action
    if (action === 'RELEASE_ESCROW') {
      // Farmer wins — release payment to farmer
      escrowResult = await releaseEscrow(tx?.gateway_ref, tx?.farmer_payout, tx?.commission_amount);
      await prisma.transaction.update({ where: { transaction_id: tx.transaction_id }, data: { escrow_status: 'RELEASED', payout_status: 'PAID', released_at: new Date() } });
      await prisma.deal.update({ where: { deal_id: dispute.deal_id }, data: { status: 'COMPLETED' } });
      await audit.log({ action: 'ESCROW_RELEASED', entityType: 'Transaction', entityId: dispute.deal_id, actorId: req.user.id, actorType: 'ADMIN', metadata: { resolution: 'admin_release' } });
    } else if (action === 'REFUND_BUYER') {
      // Buyer wins — refund
      escrowResult = await refundEscrow(tx?.gateway_ref, tx?.amount);
      await prisma.transaction.update({ where: { transaction_id: tx.transaction_id }, data: { escrow_status: 'REFUNDED', payout_status: 'FAILED', released_at: new Date() } });
      await prisma.deal.update({ where: { deal_id: dispute.deal_id }, data: { status: 'CANCELLED' } });
      await audit.log({ action: 'ESCROW_REFUNDED', entityType: 'Transaction', entityId: dispute.deal_id, actorId: req.user.id, actorType: 'ADMIN', metadata: { resolution: 'admin_refund' } });
    } else if (action === 'PARTIAL_RELEASE') {
      // Partial — release half to farmer, refund rest
      const half = tx.farmer_payout / 2;
      escrowResult = await releaseEscrow(tx?.gateway_ref, half, tx?.commission_amount);
      await prisma.transaction.update({ where: { transaction_id: tx.transaction_id }, data: { escrow_status: 'RELEASED', payout_status: 'PAID', released_at: new Date() } });
      await prisma.deal.update({ where: { deal_id: dispute.deal_id }, data: { status: 'COMPLETED' } });
    }

    const resolved = await prisma.dispute.update({
      where: { dispute_id: req.params.disputeId },
      data: { resolution, resolved_by: req.user.id, status: 'RESOLVED' },
    });

    await audit.log({ action: 'DISPUTE_RESOLVED', entityType: 'Dispute', entityId: dispute.dispute_id, actorId: req.user.id, actorType: 'ADMIN', metadata: { resolution, action } });

    res.json({ success: true, dispute: resolved, escrow: escrowResult?.message });
  } catch (err) { next(err); }
});

module.exports = router;
