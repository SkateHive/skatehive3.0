/**
 * The one SMTP transport every outgoing Skatehive email goes through.
 *
 * Four routes had built their own byte-identical copy of this, which is how a
 * setting gets fixed in three places and missed in the fourth.
 */
import nodemailer from "nodemailer";
import { EMAIL_DEFAULTS } from "@/config/app.config";

export function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || EMAIL_DEFAULTS.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || String(EMAIL_DEFAULTS.SMTP_PORT), 10),
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === "true"
      : EMAIL_DEFAULTS.SMTP_SECURE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/** Address outgoing mail is sent from. */
export function fromAddress() {
  return process.env.EMAIL_USER || EMAIL_DEFAULTS.FROM_ADDRESS;
}
