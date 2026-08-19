import { env } from "../../../config/env";
import { escapeHtml } from "./escape";

export interface SuspendedTemplateData {
  businessName: string;
  reason: string;
}

export function suspendedTemplate({
  businessName,
  reason,
}: SuspendedTemplateData): { subject: string; html: string; text: string } {
  const name = escapeHtml(businessName);
  const reasonHtml = escapeHtml(reason);
  const supportEmail = env.supportEmail;

  const subject = `Your business "${businessName}" has been suspended`;
  const text = `We're sorry to say that ${businessName} has been suspended and is no longer publicly visible on Nookly.\n\nReason: ${reason}\n\nIf you believe this is a mistake, please contact us at ${supportEmail} and we'll take a look.`;
  const html = `
    <p>We're sorry to say that <strong>${name}</strong> has been suspended and
    is no longer publicly visible on Nookly.</p>
    <p><strong>Reason:</strong> ${reasonHtml}</p>
    <p>If you believe this is a mistake, please contact us at
    <a href="mailto:${supportEmail}">${supportEmail}</a> and we'll take a look.</p>
  `;

  return { subject, html, text };
}
