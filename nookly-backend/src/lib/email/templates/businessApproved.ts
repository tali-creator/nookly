import { env } from "../../../config/env";
import { escapeHtml } from "./escape";

export interface ApprovedTemplateData {
  businessName: string;
  businessId: string;
}

export function approvedTemplate({
  businessName,
  businessId,
}: ApprovedTemplateData): { subject: string; html: string; text: string } {
  const name = escapeHtml(businessName);
  const listingUrl = `${env.frontendUrl}/business/${businessId}`;

  const subject = `Your business "${businessName}" is now live on Nookly`;
  const text = `Great news, ${businessName} is now live on Nookly!\n\nYour listing is publicly visible to customers searching nearby. View it here: ${listingUrl}`;
  const html = `
    <p>Great news!</p>
    <p><strong>${name}</strong> is now live on Nookly. Your listing is publicly
    visible to customers searching nearby.</p>
    <p><a href="${listingUrl}">View your listing</a></p>
  `;

  return { subject, html, text };
}
