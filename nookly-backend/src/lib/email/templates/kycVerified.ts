import { escapeHtml } from "./escape";

export interface KycVerifiedTemplateData {
  // No data fields needed today; kept for consistency with other templates.
}

export function kycVerifiedTemplate(_: KycVerifiedTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Your Nookly identity verification was approved";
  const text =
    "Great news! Your identity verification was approved. Your businesses can now be reviewed for approval and go live on Nookly.";
  const html = `
    <p>Great news!</p>
    <p>Your identity verification was <strong>approved</strong>. You can now
    list and manage businesses, and they are eligible for approval and being
    shown live on Nookly.</p>
  `;

  return { subject, html, text };
}