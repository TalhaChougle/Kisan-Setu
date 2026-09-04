// middleware/validate.js
const Joi = require('joi');

/**
 * Factory: returns middleware that validates req.body against a Joi schema.
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message),
      });
    }
    req.body = value;
    next();
  };
}

/**
 * Common Joi schemas
 */
const schemas = {
  sendOtp: Joi.object({
    mobile: Joi.string().pattern(/^[6-9]\d{9}$/).required().messages({
      'string.pattern.base': 'Mobile must be a valid 10-digit Indian number',
    }),
    role: Joi.string().valid('FARMER', 'BUYER', 'ADMIN').required(),
  }),

  verifyOtp: Joi.object({
    mobile: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
    otp: Joi.string().length(6).required(),
    role: Joi.string().valid('FARMER', 'BUYER', 'ADMIN').required(),
    name: Joi.string().min(2).max(100).optional(),
    village: Joi.string().max(100).optional(),
    district: Joi.string().max(100).optional(),
    language_pref: Joi.string().valid('en', 'hi', 'mr').optional(),
  }),

  kyc: Joi.object({
    aadhaar_number: Joi.string().length(12).pattern(/^\d+$/).required().messages({
      'string.pattern.base': 'Aadhaar must be 12 digits',
    }),
  }),

  businessProof: Joi.object({
    business_proof_type: Joi.string()
      .valid('GST_CERTIFICATE', 'MANDI_LICENCE', 'EXPORT_LICENCE', 'FPO_REGISTRATION')
      .required(),
    business_proof_url: Joi.string().uri().required(),
  }),

  createLot: Joi.object({
    commodity: Joi.string().min(2).max(50).required(),
    variety: Joi.string().max(50).optional().allow(''),
    grade: Joi.string().valid('A', 'B', 'C').required(),
    quantity: Joi.number().positive().max(10000).required(),
    photo_url: Joi.string().uri().optional().allow(''),
    location: Joi.string().max(100).optional().allow(''),
    village: Joi.string().max(100).optional().allow(''),
    district: Joi.string().max(100).required(),
    season: Joi.string().valid('kharif', 'rabi', 'zaid').required(),
    harvest_date: Joi.date().iso().optional(),
    organic_flag: Joi.boolean().default(false),
    asking_price: Joi.number().positive().required(),
  }),

  updateLot: Joi.object({
    quantity: Joi.number().positive().optional(),
    asking_price: Joi.number().positive().optional(),
    grade: Joi.string().valid('A', 'B', 'C').optional(),
    organic_flag: Joi.boolean().optional(),
    photo_url: Joi.string().uri().optional().allow(''),
  }),

  createOffer: Joi.object({
    price: Joi.number().positive().required(),
    quantity: Joi.number().positive().optional(),
    message: Joi.string().max(500).optional().allow(''),
  }),

  counterOffer: Joi.object({
    price: Joi.number().positive().required(),
    message: Joi.string().max(500).optional().allow(''),
  }),

  confirmHandoff: Joi.object({
    confirmed_quantity: Joi.number().positive().required(),
    confirmed_grade: Joi.string().valid('A', 'B', 'C').required(),
  }),

  raiseDispute: Joi.object({
    reason: Joi.string().min(10).max(200).required(),
    description: Joi.string().max(1000).optional().allow(''),
    evidence_url: Joi.string().uri().optional().allow(''),
  }),

  resolveDispute: Joi.object({
    resolution: Joi.string().min(10).max(500).required(),
    action: Joi.string().valid('RELEASE_ESCROW', 'REFUND_BUYER', 'PARTIAL_RELEASE').required(),
  }),

  lotSearch: Joi.object({
    commodity: Joi.string().optional(),
    variety: Joi.string().optional(),
    grade: Joi.string().valid('A', 'B', 'C').optional(),
    district: Joi.string().optional(),
    min_price: Joi.number().optional(),
    max_price: Joi.number().optional(),
    min_quantity: Joi.number().optional(),
    max_quantity: Joi.number().optional(),
    organic_flag: Joi.boolean().optional(),
    season: Joi.string().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
  }),
};

module.exports = { validate, schemas };
