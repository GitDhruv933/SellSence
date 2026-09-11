# Dukaan Manager — Backend

Express + SQLite API: auth (phone/OTP), inventory, sales, purchases,
analytics (revenue/profit/loss + buy-more/buy-less suggestions), and an AI
shop assistant.

## Setup
```bash
npm install
cp .env.example .env
npm run dev      # or: npm start
```
Runs on http://localhost:4000 by default.

## Sending real OTP SMS
By default (`SMS_PROVIDER` unset in `.env`) the OTP is logged to the console
and returned in the API response as `devOtp` — fine for local testing, not
for production. To send real SMS, set `SMS_PROVIDER` to one of:

- `twilio` — set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- `msg91` — set `MSG91_AUTH_KEY`, `MSG91_SENDER_ID`, `MSG91_FLOW_ID` (needs a DLT-approved template for Indian numbers)
- `fast2sms` — set `FAST2SMS_API_KEY` (simplest to set up for India-only OTP)

Once a real provider is configured, `devOtp` is no longer included in the
response — only the phone receives it.

See `services/sms.js` for the integration code.
