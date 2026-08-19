import { env } from "../../../config/env";

export interface PasswordResetTemplateData {
  resetUrl: string;
}

export function passwordResetTemplate({
  resetUrl,
}: PasswordResetTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Reset your Nookly password";
  const text = `We received a request to reset your Nookly password.\n\nOpen this link to choose a new password (valid for 30 minutes):\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email — your password will not change.\n\nNeed help? Contact ${env.supportEmail}.`;
  const html = `
    <p>We received a request to reset your Nookly password.</p>
    <p><a href="${resetUrl}">Choose a new password</a></p>
    <p>This link is valid for <strong>30 minutes</strong>. If you did not
    request a password reset, you can safely ignore this email — your password
    will not change.</p>
    <p>Need help? Contact ${env.supportEmail}.</p>
  `;

  return { subject, html, text };
}