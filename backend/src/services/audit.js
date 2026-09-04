// services/audit.js
// ── Audit Log Service ─────────────────────────────────────────────────────
// Append-only audit trail. Never update or delete audit_log records.

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

/**
 * Write an immutable audit log entry.
 * @param {object} entry
 * @param {string} entry.action      - AuditAction enum value
 * @param {string} entry.entityType  - 'Lot' | 'Offer' | 'Deal' | 'Dispute' | 'User' | ...
 * @param {string} entry.entityId    - ID of the entity being acted upon
 * @param {string} [entry.actorId]   - ID of actor (farmer_id or buyer_id)
 * @param {string} [entry.actorType] - 'FARMER' | 'BUYER' | 'ADMIN'
 * @param {object} [entry.metadata]  - snapshot of state, prices, etc.
 */
async function log({ action, entityType, entityId, actorId, actorType, metadata }) {
  try {
    await prisma.auditLog.create({
      data: {
        id: uuidv4(),
        action,
        entity_type: entityType,
        entity_id: entityId,
        actor_id: actorId || null,
        actor_type: actorType || null,
        metadata: metadata || {},
      },
    });
  } catch (e) {
    // Audit log failure should NEVER break the main flow
    console.error('[AUDIT] Failed to write audit log:', e.message, { action, entityType, entityId });
  }
}

module.exports = { log };
