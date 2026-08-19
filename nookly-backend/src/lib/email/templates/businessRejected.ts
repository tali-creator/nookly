import { env } from "../../../config/env";
import { escapeHtml } from "./escape";

export interface RejectedTemplateData {
  businessName: string;
  reason: string;
}

export function rejectedTemplate({
  businessName,
  reason,
}: RejectedTemplateData): { subject: string; html: string; text: string } {
  const name = escapeHtml(businessName);
  const reasonHtml = escapeHtml(reason);
  const dashboardUrl = `${env.frontendUrl}/owner/dashboard`;

  const subject = `Your business "${businessName}" submission needs changes`;
  const text = `Your ${businessName} submission needs a few changes before it can go live.\n\nOur review notes: ${reason}\n\nPlease edit your business and resubmit it from your dashboard: ${dashboardUrl}\n\nWe're happy to help if you have any questions.`;
  const html = `
    <p>Hi there,</p>
    <p>Your <strong>${name}</strong> submission needs a few changes before it
    can go live on Nookly.</p>
    <p><strong>What we'd like you to look at:</strong></p>
    <blockquote>${reasonHtml}</blockquote>
    <p>Please edit your business and resubmit it from your dashboard:
    <a href="${dashboardUrl}">Go to your dashboard</a></p>
    <p>We're happy to help if you have any questions.</p>
  `;

  return { subject, html, text };
}
