'use strict';

const { prisma } = require('../common/prisma');
const logger = require('../common/logger/index');

/**
 * Write an audit log entry.
 * Non-throwing: audit logging should never break the request flow.
 */
const writeAudit = async ({ req, action, entity, entityId = null, metadata = null }) => {
  try {
    const impersonation = req?.impersonation;
    const auditMetadata = impersonation
      ? {
          ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata)
            ? metadata
            : metadata == null
              ? {}
              : { details: metadata }),
          impersonation: {
            sessionId: impersonation.sessionId,
            actorUserId: impersonation.actorUserId,
            targetUserId: impersonation.targetUserId,
          },
        }
      : metadata || undefined;

    await prisma.auditLog.create({
      data: {
        companyId: impersonation?.companyId || req?.user?.companyId || null,
        userId: impersonation?.actorUserId || req?.user?.id || null,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        metadata: auditMetadata,
        ipAddress: (req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '').toString().slice(0, 50),
        userAgent: (req?.headers?.['user-agent'] || '').toString().slice(0, 500),
      },
    });
  } catch (err) {
    logger.error(`Audit write failed: ${err.message}`);
  }
};

module.exports = { writeAudit };
