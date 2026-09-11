// services/email.js — sends the OTP via email using Nodemailer + Gmail.
// Set EMAIL_USER and EMAIL_PASS (a Gmail App Password, not your normal
// password) in .env. If unset, falls back to logging the OTP to the
// console — handy for local development.
const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendOtpEmail(toEmail, otp) {
  const message = `Your Dukaan Manager OTP is ${otp}. Valid for 5 minutes. Do not share this with anyone.`;

  if (!transporter) {
    console.log(`[Email - console mode] OTP for ${toEmail}: ${otp}`);
    return { sent: false, mode: 'console' };
  }

  try {
    await transporter.sendMail({
      from: `"Dukaan Manager" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: 'Your OTP Code',
      text: message,
      html: `<p>Your Dukaan Manager OTP is <b>${otp}</b>.</p><p>Valid for 5 minutes. Do not share this with anyone.</p>`,
    });
    return { sent: true, mode: 'gmail' };
  } catch (err) {
    // Never let an email outage block login entirely during development —
    // log the failure and fall back to console mode so testing isn't blocked.
    console.error('Email send failed, falling back to console:', err.message);
    console.log(`[Email - fallback] OTP for ${toEmail}: ${otp}`);
    return { sent: false, mode: 'fallback', error: err.message };
  }
}

module.exports = { sendOtpEmail };
