import { env } from "../../../config/env";
import { escapeHtml } from "./escape";

export interface KycRejectedTemplateData {
  reason: string;
}

export function kycRejectedTemplate({ reason }: KycRejectedTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const safeReason = escapeHtml(reason);
  const resubmitUrl = `${env.frontendUrl}/owner/kyc.html`;

  const subject = "Your Nookly identity verification was rejected";
  const text = `Your identity verification was not approved for the following reason:\n\n${reason}\n\nYou can submit updated documents here: ${resubmitUrl}`;
  const html = `
    <p>Unfortunately, your identity verification was <strong>not approved</strong>.</p>
    <p><strong>Reason:</strong> ${safeReason}</p>
    <p>You can submit updated documents for re-review at any time:
    <a href="${resubmitUrl}">Resubmit your verification</a></p>
  `;

  return { subject, html, text };
}