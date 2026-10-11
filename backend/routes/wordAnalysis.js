// routes/wordAnalysis.js - "Smart Competitor" word analysis.
//
// Normal word analysis only looks at a vendor's own reviews. This adds a
// second lens: run the same complaint-mining engine on a *rival's* negative
// reviews instead, so a vendor can see what customers hate about the other
// shop before they ever compete for the same customer.
//
// Two ways to point it at a rival:
//   1. In-app rival (GET /word-analysis/vendor/:vendorId) - SellSence already
//      has other vendors, categorized and reviewed, in the same database
//      (this is the same category-matching idea routes/businessReport.js
//      uses for its competitor count). Reviews are already visible per-
//      product on the public product page, so this just aggregates them.
//   2. Pasted external reviews (POST /word-analysis/external) - for a rival
//      that isn't on SellSence at all (an Amazon/Flipkart listing, a
//      competitor's Instagram comments, etc). We do NOT live-scrape those
//      sites: scraping breaks their terms of use and breaks again the next
//      time their page markup changes, for a feature that's supposed to be
//      reliable. Instead the vendor copies the review text themselves and
//      pastes it in - same analysis engine, no scraper to maintain.
const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const { analyzeComments } = require('../utils/wordAnalysis');
const router = express.Router();

router.use(authRequired);

const DEFAULT_NEGATIVE_MAX = 2; // ratings 1-2 count as "negative" by default

function clampRatingMax(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 5) return DEFAULT_NEGATIVE_MAX;
  return Math.round(n);
}

// GET /word-analysis/own?rating_max=2
// What your own customers complain about (default: reviews rated <= 2).
router.get('/own', (req, res) => {
  const ratingMax = clampRatingMax(req.query.rating_max);

  const rows = db
    .prepare(
      `SELECT comment FROM reviews
       WHERE vendor_id = ? AND rating <= ? AND comment IS NOT NULL AND TRIM(comment) != ''`
    )
    .all(req.userId, ratingMax);

  const totals = db
    .prepare('SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS avg_rating FROM reviews WHERE vendor_id = ?')
    .get(req.userId);

  if (rows.length === 0) {
    return res.json({
      ratingMax,
      totalReviews: totals.total,
      avgRating: Number(totals.avg_rating.toFixed(2)),
      reviewsAnalyzed: 0,
      topPhrases: [],
      topWords: [],
      message: 'No negative reviews with written comments yet - nothing to analyze.',
    });
  }

  const analysis = analyzeComments(rows.map((r) => r.comment));
  res.json({ ratingMax, totalReviews: totals.total, avgRating: Number(totals.avg_rating.toFixed(2)), ...analysis });
});

// GET /word-analysis/rivals
// Other vendors in the same shop_category, so the vendor can pick one to
// run the competitor analysis against. Same free-text category match used
// by the Local Business Report's competitor count.
router.get('/rivals', (req, res) => {
  const self = db.prepare('SELECT shop_category FROM users WHERE id = ?').get(req.userId);
  if (!self || !self.shop_category || !self.shop_category.trim()) {
    return res.json({ rivals: [], message: 'Set your shop category first (Inventory/Profile) to find rivals.' });
  }

  const rivals = db
    .prepare(
      `SELECT u.id, u.shop_name, u.shop_category,
         (SELECT COUNT(*) FROM reviews r WHERE r.vendor_id = u.id) AS review_count,
         (SELECT COUNT(*) FROM reviews r WHERE r.vendor_id = u.id AND r.rating <= ?) AS negative_review_count
       FROM users u
       WHERE u.role = 'vendor' AND u.id != ? AND LOWER(TRIM(u.shop_category)) = LOWER(TRIM(?))
       ORDER BY negative_review_count DESC, review_count DESC`
    )
    .all(DEFAULT_NEGATIVE_MAX, req.userId, self.shop_category);

  res.json({ category: self.shop_category, rivals });
});

// GET /word-analysis/vendor/:vendorId?rating_max=2
// The "Smart Competitor" analysis - what THEIR customers complain about.
router.get('/vendor/:vendorId', (req, res) => {
  const vendorId = Number(req.params.vendorId);
  if (!Number.isInteger(vendorId) || vendorId === req.userId) {
    return res.status(400).json({ error: 'Pick a different vendor to compare against.' });
  }

  const vendor = db.prepare(`SELECT id, shop_name, shop_category FROM users WHERE id = ? AND role = 'vendor'`).get(vendorId);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

  const ratingMax = clampRatingMax(req.query.rating_max);

  const rows = db
    .prepare(
      `SELECT comment FROM reviews
       WHERE vendor_id = ? AND rating <= ? AND comment IS NOT NULL AND TRIM(comment) != ''`
    )
    .all(vendorId, ratingMax);

  const totals = db
    .prepare('SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS avg_rating FROM reviews WHERE vendor_id = ?')
    .get(vendorId);

  if (rows.length === 0) {
    return res.json({
      vendor,
      ratingMax,
      totalReviews: totals.total,
      avgRating: Number(totals.avg_rating.toFixed(2)),
      reviewsAnalyzed: 0,
      topPhrases: [],
      topWords: [],
      message: `No negative reviews with written comments found for ${vendor.shop_name} yet.`,
    });
  }

  const analysis = analyzeComments(rows.map((r) => r.comment));
  res.json({ vendor, ratingMax, totalReviews: totals.total, avgRating: Number(totals.avg_rating.toFixed(2)), ...analysis });
});

// POST /word-analysis/external { text, source_label? }
// Analyze reviews pasted in from anywhere outside the app (Amazon, Flipkart,
// a competitor's social page). No live scraping - see file header for why.
router.post('/external', (req, res) => {
  const { text, source_label } = req.body || {};
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return res.status(400).json({ error: 'Paste some review text (at least a sentence or two) to analyze.' });
  }
  if (text.length > 50000) {
    return res.status(400).json({ error: 'That\'s too much text at once - paste a smaller batch of reviews.' });
  }

  // Reviews pasted from a listing page usually land one-per-line, or
  // separated by a star-rating marker ("4.0 out of 5 stars", "★★★☆☆") at
  // the start of the next review - split on either.
  const chunks = text
    .split(/\r?\n+|(?=\b[1-5](?:\.0)?\s*(?:out of 5 stars|stars?|★)\b)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  const comments = chunks.length > 1 ? chunks : [text.trim()];
  const analysis = analyzeComments(comments);

  res.json({ sourceLabel: (source_label || 'Pasted reviews').trim().slice(0, 120), ...analysis });
});

module.exports = router;
