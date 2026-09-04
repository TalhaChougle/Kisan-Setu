// services/mock-ekyc.js
// ── Aadhaar e-KYC Mock Provider ────────────────────────────────────────────
// IMPORTANT: Raw Aadhaar numbers are NEVER persisted to the database.
// Only aadhaar_verified (boolean) + verified_at (timestamp) are stored.
//
// Swap-in point: Replace the verifyAadhaar export with a real UIDAI/Digilocker
// API call. Keep the same interface: accepts aadhaar_number string, returns
// { verified: boolean, message: string }

const INVALID_TEST_NUMBERS = ['000000000000', '111111111111', '999999999999'];

/**
 * Mock Aadhaar e-KYC verification.
 * @param {string} aadhaarNumber - 12-digit Aadhaar number (NEVER stored)
 * @param {string} mobile - registered mobile to cross-check (optional mock check)
 * @returns {{ verified: boolean, message: string }}
 */
async function verifyAadhaar(aadhaarNumber, mobile) {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 300));

  // Basic format validation
  if (!/^\d{12}$/.test(aadhaarNumber)) {
    return { verified: false, message: 'Invalid Aadhaar format. Must be 12 digits.' };
  }

  // Known invalid test numbers
  if (INVALID_TEST_NUMBERS.includes(aadhaarNumber)) {
    return { verified: false, message: 'Aadhaar verification failed — number not found in UIDAI records.' };
  }

  // Mock: treat any valid 12-digit number that doesn't end in '0' as verified
  // (numbers ending in '0' simulate failed verification for testing)
  if (aadhaarNumber.endsWith('0000')) {
    return { verified: false, message: 'Aadhaar biometric mismatch. Please visit your nearest Aadhaar centre.' };
  }

  // In production: call UIDAI OTP-based e-KYC API or Digilocker
  console.log(`[MOCK e-KYC] Verification request for Aadhaar ending in ...${aadhaarNumber.slice(-4)} → VERIFIED`);

  return { verified: true, message: 'Aadhaar e-KYC verification successful.' };
}

module.exports = { verifyAadhaar };
