// services/sms.js — sends the OTP via a real SMS gateway.
// Supports Twilio, MSG91, and Fast2SMS (all popular in India). Set SMS_PROVIDER
// in .env to pick one. If unset (or provider isn't configured), falls back to
// logging the OTP to the console — handy for local development.
const fetch = require('node-fetch');

async function sendViaTwilio(phone, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ To: phone, From: from, Body: message })
  });
  if (!res.ok) throw new Error(`Twilio error: ${res.status} ${await res.text()}`);
}

async function sendViaMsg91(phone, message) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID || 'DUKAAN';
  const digitsOnly = phone.replace(/^\+/, '');

  const res = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authkey: authKey },
    body: JSON.stringify({
      // Simple transactional SMS via MSG91's flow API — swap flow_id for your
      // approved DLT template ID (mandatory for India SMS routing).
      flow_id: process.env.MSG91_FLOW_ID,
      sender: senderId,
      mobiles: digitsOnly,
      OTP: message.match(/\d{6}/)?.[0] || message
    })
  });
  if (!res.ok) throw new Error(`MSG91 error: ${res.status} ${await res.text()}`);
}

async function sendViaFast2Sms(phone, message) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const digitsOnly = phone.replace(/^\+91/, '').replace(/^\+/, '');

  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: { authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      route: 'otp',
      variables_values: message.match(/\d{6}/)?.[0] || message,
      numbers: digitsOnly
    })
  });
  if (!res.ok) throw new Error(`Fast2SMS error: ${res.status} ${await res.text()}`);
}

async function sendOtpSms(phone, otp) {
  const provider = (process.env.SMS_PROVIDER || 'console').toLowerCase();
  const message = `Your Dukaan Manager OTP is ${otp}. Valid for 5 minutes. Do not share this with anyone.`;

  try {
    if (provider === 'twilio') {
      await sendViaTwilio(phone, message);
    } else if (provider === 'msg91') {
      await sendViaMsg91(phone, message);
    } else if (provider === 'fast2sms') {
      await sendViaFast2Sms(phone, message);
    } else {
      console.log(`[SMS - console mode] OTP for ${phone}: ${otp}`);
      return { sent: false, mode: 'console' };
    }
    return { sent: true, mode: provider };
  } catch (err) {
    // Never let an SMS gateway outage block login entirely during development —
    // log the failure and fall back to console mode so testing isn't blocked.
    console.error('SMS send failed, falling back to console:', err.message);
    console.log(`[SMS - fallback] OTP for ${phone}: ${otp}`);
    return { sent: false, mode: 'fallback', error: err.message };
  }
}

module.exports = { sendOtpSms };
