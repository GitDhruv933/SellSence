// utils/qualitySignal.js - a deliberately small keyword check, not a
// sentiment model. It answers one narrow question for the pricing engine:
// "does this positive review specifically praise build/material quality
// (as opposed to just being a generic 5-star review)?" - because only the
// former is evidence a customer might tolerate a higher price.
const QUALITY_KEYWORDS = [
  'quality', 'premium', 'durable', 'durability', 'sturdy', 'solid',
  'excellent material', 'well made', 'well-made', 'worth every', 'worth it',
  'superior', 'long lasting', 'long-lasting', 'top notch', 'topnotch',
  'great material', 'built to last', 'high grade', 'high-grade', 'genuine',
  'authentic', 'premium quality', 'solid build', 'sturdy build',
];

function mentionsQuality(comment) {
  const lower = (comment || '').toLowerCase();
  return QUALITY_KEYWORDS.some((kw) => lower.includes(kw));
}

module.exports = { mentionsQuality, QUALITY_KEYWORDS };
