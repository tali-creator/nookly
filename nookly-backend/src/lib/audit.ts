import type { Prisma } from "@prisma/client";
import prisma from "../models/prisma";

// Persistent audit trail for admin moderation actions. Every call writes a row
// to audit_logs (immutable) AND keeps the console.log for local dev visibility.
export async function writeAuditLog(input: {
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  const { actorId, actorRole, action, targetType, targetId, metadata } = input;
  try {
    await prisma.auditLog.create({
      data: { actorId, actorRole, action, targetType, targetId, metadata },
    });
  } catch (err) {
    // A failed audit write must never break the admin action itself.
    console.error("[nookly:audit] failed to persist audit log:", err);
  }
  console.log(
    `[nookly:admin] ${actorId} (${actorRole}) ${action} ${targetType} ${targetId} at ${new Date().toISOString()}` +
      (metadata ? ` ${JSON.stringify(metadata)}` : "")
  );
}