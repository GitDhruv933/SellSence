// routes/pricing.js - "Smart Pricing" dynamic pricing suggestions.
//
// Two signals feed the engine, both already produced elsewhere in the app:
//   1. Views vs sales, from the new product_views counter (see below) and
//      the existing orders/order_items tables.
//   2. Quality-praise sentiment, from reviews.comment via the same kind of
//      keyword check the "Smart Competitor" word analysis is built on.
//
// Thresholds live in the pricing_rules table (seeded with sane defaults in
// db.js) instead of being hardcoded here, so a vendor override row can
// change behavior later without a code change - same "rule scoped with a
// priority, most-specific-wins" shape as Mercur's commission rules, just
// without the region/currency machinery this app doesn't need.
//
// Nothing here ever changes a price automatically. /suggestions only
// returns recommendations with their reasoning; a price only changes when
// the vendor explicitly calls /apply, and every applied change is logged
// to price_change_log so it can be reviewed (or manually undone).
const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const { mentionsQuality } = require('../utils/qualitySignal');
const router = express.Router();

const VIEW_WINDOW_DAYS = 30;
const SALES_WINDOW_DAYS = 30;

function getResolvedRule(vendorId, conditionType) {
  const vendorRule = db
    .prepare('SELECT * FROM pricing_rules WHERE vendor_id = ? AND condition_type = ? AND enabled = 1')
    .get(vendorId, conditionType);
  if (vendorRule) return vendorRule;
  return db
    .prepare('SELECT * FROM pricing_rules WHERE vendor_id IS NULL AND condition_type = ? AND enabled = 1')
    .get(conditionType);
}

// POST /pricing/track-view { product_id, viewer_key }
// Public/no-auth - fired by the customer app once per product card
// impression. viewer_key is a client-generated anonymous id (or the
// logged-in customer's id as a string); the unique index on
// (product_id, viewer_key, day) means repeat views from the same visitor
// on the same day are silently ignored, not counted twice.
router.post('/track-view', (req, res) => {
  const productId = Number(req.body?.product_id);
  const viewerKey = String(req.body?.viewer_key || '').trim();
  if (!Number.isInteger(productId) || !viewerKey) {
    return res.status(400).json({ error: 'product_id and viewer_key are required' });
  }
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  try {
    db.prepare('INSERT INTO product_views (product_id, viewer_key) VALUES (?, ?)').run(productId, viewerKey.slice(0, 120));
  } catch {
    // Unique constraint hit = already counted for this viewer today. Fine.
  }
  res.status(204).end();
});

router.use(authRequired);

// GET /pricing/suggestions - Smart Pricing recommendations for every one
// of the calling vendor's products that trips a rule.
router.get('/suggestions', (req, res) => {
  const vendorId = req.userId;
  const products = db.prepare('SELECT * FROM products WHERE user_id = ?').all(vendorId);

  const viewsRule = getResolvedRule(vendorId, 'high_views_low_sales');
  const qualityRule = getResolvedRule(vendorId, 'positive_quality_sentiment');

  const suggestions = [];

  for (const product of products) {
    const views = db
      .prepare(
        `SELECT COUNT(*) AS c FROM product_views
         WHERE product_id = ? AND viewed_at >= datetime('now', ?)`
      )
      .get(product.id, `-${VIEW_WINDOW_DAYS} days`).c;

    const sales = db
      .prepare(
        `SELECT COALESCE(SUM(oi.quantity), 0) AS q
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE oi.product_id = ? AND o.vendor_id = ? AND o.status != 'cancelled'
           AND o.created_at >= datetime('now', ?)`
      )
      .get(product.id, vendorId, `-${SALES_WINDOW_DAYS} days`).q;

    const conversion = views > 0 ? sales / views : null;

    const positiveComments = db
      .prepare(
        `SELECT comment FROM reviews
         WHERE product_id = ? AND rating >= 4 AND comment IS NOT NULL AND TRIM(comment) != ''`
      )
      .all(product.id)
      .map((r) => r.comment);
    const qualityMentions = positiveComments.filter(mentionsQuality);

    // Evaluate both conditions, then keep only the higher-priority one if
    // both somehow trip at once (contradictory advice is worse than
    // picking one) - viewsRule defaults to the higher priority (10 vs 5).
    const candidates = [];

    if (viewsRule && views >= viewsRule.threshold_views && (conversion === null || conversion <= viewsRule.threshold_conversion_rate)) {
      candidates.push({
        priority: viewsRule.priority,
        direction: 'decrease',
        pct: Math.abs(viewsRule.adjustment_pct),
        reason: `${views} views in the last ${VIEW_WINDOW_DAYS} days but only ${sales} sold - price may be the friction point.`,
        metric: { views, sales, conversion },
      });
    }

    if (qualityRule && qualityMentions.length >= qualityRule.min_positive_reviews) {
      candidates.push({
        priority: qualityRule.priority,
        direction: 'increase',
        pct: Math.abs(qualityRule.adjustment_pct),
        reason: `${qualityMentions.length} recent reviews specifically praise the quality - customers may tolerate a higher price.`,
        metric: { qualityMentions: qualityMentions.length },
      });
    }

    if (candidates.length === 0) continue;
    candidates.sort((a, b) => b.priority - a.priority);
    const chosen = candidates[0];

    const currentPrice = product.selling_price;
    const delta = chosen.direction === 'increase' ? chosen.pct / 100 : -chosen.pct / 100;
    const suggestedPrice = Math.round(currentPrice * (1 + delta) * 100) / 100;

    suggestions.push({
      product: { id: product.id, name: product.name, category: product.category, unit: product.unit },
      currentPrice,
      suggestedPrice,
      direction: chosen.direction,
      pct: chosen.pct,
      reason: chosen.reason,
      metric: chosen.metric,
      otherSignalsConsidered: candidates.length > 1,
    });
  }

  res.json({ windowDays: VIEW_WINDOW_DAYS, suggestions });
});

// POST /pricing/apply { product_id, new_price, reason }
// The only place a price actually changes. Vendor-initiated only.
router.post('/apply', (req, res) => {
  const productId = Number(req.body?.product_id);
  const newPrice = Number(req.body?.new_price);
  const reason = (req.body?.reason || '').slice(0, 300);

  if (!Number.isInteger(productId) || !Number.isFinite(newPrice) || newPrice <= 0) {
    return res.status(400).json({ error: 'product_id and a positive new_price are required' });
  }

  const product = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(productId, req.userId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const oldPrice = product.selling_price;

  db.transaction(() => {
    db.prepare(`UPDATE products SET selling_price = ?, updated_at = datetime('now') WHERE id = ?`).run(newPrice, productId);
    db.prepare(
      `INSERT INTO price_change_log (product_id, vendor_id, old_price, new_price, reason) VALUES (?, ?, ?, ?, ?)`
    ).run(productId, req.userId, oldPrice, newPrice, reason);
  })();

  res.json({
    product: db.prepare('SELECT * FROM products WHERE id = ?').get(productId),
    oldPrice,
    newPrice,
  });
});

// GET /pricing/history - recent applied price changes, most recent first.
router.get('/history', (req, res) => {
  const rows = db
    .prepare(
      `SELECT pcl.*, p.name AS product_name
       FROM price_change_log pcl JOIN products p ON p.id = pcl.product_id
       WHERE pcl.vendor_id = ?
       ORDER BY pcl.created_at DESC
       LIMIT 50`
    )
    .all(req.userId);
  res.json({ history: rows });
});

module.exports = router;
