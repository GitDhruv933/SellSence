// routes/sales.js - record and list sales; updates stock quantity
const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

router.get('/', (req, res) => {
  const sales = db.prepare(
    `SELECT s.*, p.name AS product_name FROM sales s
     JOIN products p ON p.id = s.product_id
     WHERE s.user_id = ? ORDER BY s.sale_date DESC LIMIT 200`
  ).all(req.userId);
  res.json(sales);
});

router.post('/', (req, res) => {
  const { product_id, quantity, sale_price } = req.body;
  if (!product_id || !quantity) return res.status(400).json({ error: 'product_id and quantity required' });

  const product = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(product_id, req.userId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.quantity < quantity) {
    return res.status(400).json({ error: `Only ${product.quantity} ${product.unit} in stock` });
  }

  const price = sale_price ?? product.selling_price;

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO sales (user_id, product_id, quantity, sale_price) VALUES (?, ?, ?, ?)')
      .run(req.userId, product_id, quantity, price);
    db.prepare(`UPDATE products SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ?`)
      .run(quantity, product_id);
  });
  tx();

  res.status(201).json({ message: 'Sale recorded' });
});

module.exports = router;
