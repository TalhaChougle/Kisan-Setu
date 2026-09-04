// middleware/rbac.js

/**
 * Role-based access control middleware factory.
 * Usage: rbac('FARMER') or rbac('BUYER', 'ADMIN')
 */
function rbac(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires role: ${allowedRoles.join(' or ')}`,
      });
    }
    next();
  };
}

/**
 * Ensures a buyer is fully verified before accessing protected routes.
 */
function requireVerifiedBuyer(req, res, next) {
  if (req.user.role !== 'BUYER') return next();
  if (!req.user.verified) {
    return res.status(403).json({
      success: false,
      message: 'Business verification required to perform this action.',
    });
  }
  next();
}

module.exports = { rbac, requireVerifiedBuyer };
