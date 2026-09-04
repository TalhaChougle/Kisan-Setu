// services/mock-payment.js
// ── Mock Payment / Escrow Service ──────────────────────────────────────────
// Simulates Razorpay Route behaviour for escrow hold/release/refund.
//
// Swap-in point: Replace these functions with real Razorpay Route API calls.
// Interface contract:
//   holdEscrow(dealId, amount)   → { success, gatewayRef, message }
//   releaseEscrow(gatewayRef, farmerPayout, commissionAmount) → { success, message }
//   refundEscrow(gatewayRef, amount)  → { success, message }

const { v4: uuidv4 } = require('uuid');

/**
 * Hold payment in escrow when deal is confirmed.
 * In production: create a Razorpay Route transfer to escrow account.
 */
async function holdEscrow(dealId, amount) {
  await new Promise((r) => setTimeout(r, 200)); // simulate latency

  const gatewayRef = 'MOCK_ESC_' + uuidv4().split('-')[0].toUpperCase();
  console.log(`[MOCK ESCROW] HOLD: dealId=${dealId} amount=₹${amount} ref=${gatewayRef}`);

  return {
    success: true,
    gatewayRef,
    message: `Escrow held: ₹${amount} for deal ${dealId}`,
  };
}

/**
 * Release escrow to farmer (minus commission) after both-side handoff confirmation.
 * In production: trigger Razorpay Route transfer to farmer's bank account.
 */
async function releaseEscrow(gatewayRef, farmerPayout, commissionAmount) {
  await new Promise((r) => setTimeout(r, 200));

  console.log(`[MOCK ESCROW] RELEASE: ref=${gatewayRef} farmerPayout=₹${farmerPayout} commission=₹${commissionAmount}`);

  return {
    success: true,
    message: `Escrow released. Farmer receives ₹${farmerPayout}. Platform commission: ₹${commissionAmount}`,
  };
}

/**
 * Refund escrow back to buyer (dispute resolved in buyer's favour).
 * In production: initiate Razorpay refund.
 */
async function refundEscrow(gatewayRef, amount) {
  await new Promise((r) => setTimeout(r, 200));

  console.log(`[MOCK ESCROW] REFUND: ref=${gatewayRef} amount=₹${amount}`);

  return {
    success: true,
    message: `Escrow refunded: ₹${amount} returned to buyer.`,
  };
}

module.exports = { holdEscrow, releaseEscrow, refundEscrow };
