// routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { validate, schemas } = require('../middleware/validate');

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'kisansetu_jwt_super_secret_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ── OTP Generation ─────────────────────────────────────────────────────────
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * POST /api/auth/send-otp
 * Sends (mock) OTP to mobile. In dev mode, OTP is returned in response.
 */
router.post('/send-otp', validate(schemas.sendOtp), async (req, res, next) => {
  try {
    const { mobile, role } = req.body;
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Invalidate any existing unexpired OTPs for this mobile+role
    await prisma.otpVerification.updateMany({
      where: { mobile, user_type: role, verified: false },
      data: { verified: true }, // mark old ones as used
    });

    await prisma.otpVerification.create({
      data: {
        id: uuidv4(),
        mobile,
        otp,
        user_type: role,
        expires_at: expiresAt,
      },
    });

    // In production: send OTP via SMS/WhatsApp. Here we log + return for dev.
    console.log(`[MOCK OTP] ${role} ${mobile} → OTP: ${otp}`);

    res.json({
      success: true,
      message: `OTP sent to ${mobile}`,
      // DEV ONLY — remove in production:
      dev_otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/verify-otp
 * Verifies OTP, creates user if first time, returns JWT.
 */
router.post('/verify-otp', validate(schemas.verifyOtp), async (req, res, next) => {
  try {
    const { mobile, otp, role, name, village, district, language_pref } = req.body;

    // Find valid OTP
    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        mobile,
        otp,
        user_type: role,
        verified: false,
        expires_at: { gte: new Date() },
      },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Mark OTP as used
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    let user;
    let isNewUser = false;

    if (role === 'FARMER') {
      user = await prisma.farmer.findUnique({ where: { mobile } });
      if (!user) {
        user = await prisma.farmer.create({
          data: {
            farmer_id: uuidv4(),
            name: name || `Farmer_${mobile.slice(-4)}`,
            mobile,
            mobile_verified: true,
            village: village || '',
            district: district || '',
            language_pref: language_pref || 'en',
          },
        });
        isNewUser = true;
      } else {
        user = await prisma.farmer.update({
          where: { mobile },
          data: { mobile_verified: true, ...(name && { name }), ...(language_pref && { language_pref }) },
        });
      }

      const token = signToken({
        id: user.farmer_id,
        role: 'FARMER',
        mobile: user.mobile,
        aadhaar_verified: user.aadhaar_verified,
      });

      return res.json({
        success: true,
        isNewUser,
        token,
        user: {
          id: user.farmer_id,
          name: user.name,
          mobile: user.mobile,
          role: 'FARMER',
          aadhaar_verified: user.aadhaar_verified,
          language_pref: user.language_pref,
        },
      });
    }

    if (role === 'BUYER') {
      user = await prisma.buyer.findUnique({ where: { mobile } });
      if (!user) {
        user = await prisma.buyer.create({
          data: {
            buyer_id: uuidv4(),
            name: name || `Buyer_${mobile.slice(-4)}`,
            mobile,
            mobile_verified: true,
            verification_status: 'PENDING',
          },
        });
        isNewUser = true;
      } else {
        user = await prisma.buyer.update({
          where: { mobile },
          data: { mobile_verified: true, ...(name && { name }) },
        });
      }

      const token = signToken({
        id: user.buyer_id,
        role: 'BUYER',
        mobile: user.mobile,
        aadhaar_verified: user.aadhaar_verified,
        verified: user.verification_status === 'VERIFIED',
      });

      return res.json({
        success: true,
        isNewUser,
        token,
        user: {
          id: user.buyer_id,
          name: user.name,
          mobile: user.mobile,
          role: 'BUYER',
          aadhaar_verified: user.aadhaar_verified,
          verification_status: user.verification_status,
        },
      });
    }

    if (role === 'ADMIN') {
      // Admin login is OTP-less in dev; just check mobile
      user = await prisma.admin.findUnique({ where: { mobile } });
      if (!user) {
        return res.status(403).json({ success: false, message: 'Admin account not found.' });
      }
      const token = signToken({ id: user.admin_id, role: 'ADMIN', mobile: user.mobile });
      return res.json({
        success: true,
        token,
        user: { id: user.admin_id, name: user.name, role: 'ADMIN', mobile: user.mobile },
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid role.' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/admin-login
 * Admin login with password (alternative to OTP)
 */
router.post('/admin-login', async (req, res, next) => {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password) {
      return res.status(400).json({ success: false, message: 'Mobile and password required.' });
    }

    const admin = await prisma.admin.findUnique({ where: { mobile } });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid password.' });
    }

    const token = signToken({ id: admin.admin_id, role: 'ADMIN', mobile: admin.mobile });
    res.json({
      success: true,
      token,
      user: { id: admin.admin_id, name: admin.name, role: 'ADMIN', mobile: admin.mobile },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Returns current user from JWT
 */
router.get('/me', require('../middleware/auth').authenticate, async (req, res, next) => {
  try {
    const { id, role } = req.user;
    let user;

    if (role === 'FARMER') {
      user = await prisma.farmer.findUnique({ where: { farmer_id: id } });
      if (!user) return res.status(404).json({ success: false, message: 'Farmer not found.' });
      return res.json({ success: true, user: { ...user, role: 'FARMER' } });
    }
    if (role === 'BUYER') {
      user = await prisma.buyer.findUnique({ where: { buyer_id: id } });
      if (!user) return res.status(404).json({ success: false, message: 'Buyer not found.' });
      return res.json({ success: true, user: { ...user, role: 'BUYER' } });
    }
    if (role === 'ADMIN') {
      user = await prisma.admin.findUnique({ where: { admin_id: id }, select: { admin_id: true, name: true, mobile: true, role: true, email: true } });
      if (!user) return res.status(404).json({ success: false, message: 'Admin not found.' });
      return res.json({ success: true, user: { ...user, role: 'ADMIN' } });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
