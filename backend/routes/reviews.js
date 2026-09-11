// routes/reviews.js - product review system.
//
// A review can only be left by the customer who actually placed the order,
// only for an item that was really in that order, and only once the order
// has been delivered - this keeps ratings tied to a verified purchase
// instead of letting anyone review anything.
const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

// GET /reviews/product/:productId - public list + summary for a product's
// page on the customer site. No auth required, same as /shops.
router.get('/product/:productId', (req, res) => {
  const productId = req.params.productId;
  const reviews = db
    .prepare(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS customer_name
       FROM reviews r JOIN users u ON u.id = r.customer_id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(productId);

  const summary = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS average
       FROM reviews WHERE product_id = ?`
    )
    .get(productId);

  res.json({
    reviews,
    count: summary.count,
    average: summary.count > 0 ? Number(summary.average.toFixed(2)) : 0,
  });
});

router.use(authRequired);

// GET /reviews/reviewable - the calling customer's delivered order items
// that don't have a review yet, so the app can prompt "rate your order".
router.get('/reviewable', (req, res) => {
  const rows = db
    .prepare(
      `SELECT oi.id AS order_item_id, oi.order_id, oi.product_id, oi.product_name, oi.quantity,
              o.vendor_id, u.shop_name, o.updated_at AS delivered_at
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN users u ON u.id = o.vendor_id
       WHERE o.customer_id = ? AND o.status = 'delivered'
         AND NOT EXISTS (
           SELECT 1 FROM reviews r WHERE r.order_id = oi.order_id AND r.product_id = oi.product_id
         )
       ORDER BY o.updated_at DESC`
    )
    .all(req.userId);
  res.json(rows);
});

// POST /reviews - leave a review for one item of one of the caller's own,
// already-delivered orders.
router.post('/', (req, res) => {
  const { order_id, product_id, rating, comment } = req.body;

  const ratingNum = Number(rating);
  if (!order_id || !product_id || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'order_id, product_id, and an integer rating 1-5 are required' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?').get(order_id, req.userId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'delivered') {
    return res.status(400).json({ error: 'You can only review items from a delivered order' });
  }

  const item = db
    .prepare('SELECT * FROM order_items WHERE order_id = ? AND product_id = ?')
    .get(order_id, product_id);
  if (!item) return res.status(400).json({ error: 'That item was not part of this order' });

  const existing = db
    .prepare('SELECT id FROM reviews WHERE order_id = ? AND product_id = ?')
    .get(order_id, product_id);
  if (existing) return res.status(409).json({ error: 'You already reviewed this item' });

  const info = db
    .prepare(
      `INSERT INTO reviews (product_id, vendor_id, customer_id, order_id, rating, comment)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(product_id, order.vendor_id, req.userId, order_id, ratingNum, (comment || '').trim());

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(review);
});

module.exports = router;
