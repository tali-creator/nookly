import { env } from "../../config/env";
import { getResend } from "./client";

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Sends a transactional email. NEVER throws: an email failure must never
// break the admin action that triggered it. When RESEND_API_KEY is missing
// (e.g. local dev), the email content is logged to console instead.
export async function sendEmail(data: EmailData): Promise<void> {
  const resend = getResend();

  if (!resend) {
    console.log(`[nookly:email] (no RESEND_API_KEY) would send to ${data.to}`);
    console.log(`[nookly:email]   subject: ${data.subject}`);
    console.log(`[nookly:email]   text: ${data.text}`);
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: env.emailFrom,
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
    });
    if (error) {
      console.error(`[nookly:email] send failed for ${data.to}:`, error);
    } else {
      console.log(`[nookly:email] sent "${data.subject}" to ${data.to}`);
    }
  } catch (err) {
    console.error(`[nookly:email] unexpected error for ${data.to}:`, err);
  }
}