// services/mock-notify.js
// ── Mock SMS / WhatsApp Notification Service ───────────────────────────────
// Logs to console + stores every notification in the DB.
//
// Swap-in point: Replace sendSMS / sendWhatsApp with real calls to
// Twilio, MSG91, or WhatsApp Business API. Keep the same interface:
//   send({ userId, userType, channel, mobile, message, metadata })
//   → { success: boolean, sid?: string }

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Core notification sender — stores in DB and logs to console.
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.userType  FARMER | BUYER | ADMIN
 * @param {string} opts.channel   SMS | WHATSAPP | IN_APP
 * @param {string} opts.mobile    recipient phone number (for logging)
 * @param {string} opts.message   notification body
 * @param {object} [opts.metadata] arbitrary JSON metadata
 */
async function send({ userId, userType, channel, mobile, message, metadata }) {
  // 1. Log to console (dev stand-in for actual gateway call)
  const icon = channel === 'WHATSAPP' ? '💬' : channel === 'SMS' ? '📱' : '🔔';
  console.log(`[MOCK NOTIFY ${icon}] ${channel} → ${mobile}: ${message}`);

  // 2. Persist to notifications table
  try {
    await prisma.notification.create({
      data: {
        user_id: userId,
        user_type: userType,
        channel,
        message,
        metadata: metadata || {},
        delivered: true,
      },
    });
  } catch (e) {
    console.error('[MOCK NOTIFY] Failed to persist notification:', e.message);
  }

  // 3. Simulate gateway response
  // In production: replace with actual API call and return real SID/msgId
  return { success: true, sid: 'MOCK_' + Date.now() };
}

// ── Convenience helpers ────────────────────────────────────────────────────

function notifyListingConfirmed({ farmer, lot }) {
  return send({
    userId: farmer.farmer_id,
    userType: 'FARMER',
    channel: 'SMS',
    mobile: farmer.mobile,
    message: `KisanSetu: Your lot for ${lot.commodity} (${lot.quantity} qtl) is now live. Asking price: ₹${lot.asking_price}/qtl.`,
    metadata: { lot_id: lot.lot_id },
  });
}

function notifyNewOffer({ farmer, offer, lot, buyerName }) {
  return Promise.all([
    send({
      userId: farmer.farmer_id,
      userType: 'FARMER',
      channel: 'WHATSAPP',
      mobile: farmer.mobile,
      message: `KisanSetu: New offer of ₹${offer.price}/qtl received on your ${lot.commodity} lot from ${buyerName}.`,
      metadata: { offer_id: offer.offer_id, lot_id: lot.lot_id },
    }),
  ]);
}

function notifyOfferAccepted({ buyer, offer, lot }) {
  return send({
    userId: buyer.buyer_id,
    userType: 'BUYER',
    channel: 'WHATSAPP',
    mobile: buyer.mobile,
    message: `KisanSetu: Your offer of ₹${offer.price}/qtl for ${lot.commodity} has been ACCEPTED by the farmer. Proceed to confirm the deal.`,
    metadata: { offer_id: offer.offer_id, lot_id: lot.lot_id },
  });
}

function notifyOfferRejected({ buyer, offer, lot }) {
  return send({
    userId: buyer.buyer_id,
    userType: 'BUYER',
    channel: 'SMS',
    mobile: buyer.mobile,
    message: `KisanSetu: Your offer of ₹${offer.price}/qtl for ${lot.commodity} was declined. You may submit a new offer.`,
    metadata: { offer_id: offer.offer_id, lot_id: lot.lot_id },
  });
}

function notifyDealToken({ farmer, buyer, deal, lot }) {
  const msg = (name, token) =>
    `KisanSetu: Deal confirmed for ${lot.commodity} (${deal.quantity} qtl) at ₹${deal.final_price}/qtl. Deal token: ${token}. Confirm handoff within ${new Date(deal.handoff_window_end).toLocaleDateString('en-IN')}.`;

  return Promise.all([
    send({ userId: farmer.farmer_id, userType: 'FARMER', channel: 'SMS', mobile: farmer.mobile, message: msg(farmer.name, deal.token), metadata: { deal_id: deal.deal_id } }),
    send({ userId: buyer.buyer_id, userType: 'BUYER', channel: 'SMS', mobile: buyer.mobile, message: msg(buyer.name, deal.token), metadata: { deal_id: deal.deal_id } }),
  ]);
}

function notifyHandoffReminder({ farmer, buyer, deal }) {
  const deadline = new Date(deal.handoff_window_end).toLocaleDateString('en-IN');
  return Promise.all([
    send({ userId: farmer.farmer_id, userType: 'FARMER', channel: 'WHATSAPP', mobile: farmer.mobile, message: `KisanSetu Reminder: Please confirm handoff for deal ${deal.token} by ${deadline}.`, metadata: { deal_id: deal.deal_id } }),
    send({ userId: buyer.buyer_id, userType: 'BUYER', channel: 'WHATSAPP', mobile: buyer.mobile, message: `KisanSetu Reminder: Please confirm handoff for deal ${deal.token} by ${deadline}.`, metadata: { deal_id: deal.deal_id } }),
  ]);
}

function notifyPaymentReleased({ farmer, deal, transaction }) {
  return send({
    userId: farmer.farmer_id,
    userType: 'FARMER',
    channel: 'SMS',
    mobile: farmer.mobile,
    message: `KisanSetu: Payment of ₹${transaction.farmer_payout.toFixed(2)} has been released to your account for deal ${deal.token}.`,
    metadata: { deal_id: deal.deal_id, transaction_id: transaction.transaction_id },
  });
}

function notifyDisputeRaised({ farmer, buyer, dispute, deal }) {
  return Promise.all([
    send({ userId: farmer.farmer_id, userType: 'FARMER', channel: 'SMS', mobile: farmer.mobile, message: `KisanSetu: A dispute has been raised on deal ${deal.token}. Escrow is frozen pending admin review. Dispute ID: ${dispute.dispute_id}.`, metadata: { dispute_id: dispute.dispute_id } }),
    send({ userId: buyer.buyer_id, userType: 'BUYER', channel: 'SMS', mobile: buyer.mobile, message: `KisanSetu: Dispute submitted for deal ${deal.token}. Admin will review within 48 hours.`, metadata: { dispute_id: dispute.dispute_id } }),
  ]);
}

module.exports = {
  send,
  notifyListingConfirmed,
  notifyNewOffer,
  notifyOfferAccepted,
  notifyOfferRejected,
  notifyDealToken,
  notifyHandoffReminder,
  notifyPaymentReleased,
  notifyDisputeRaised,
};
