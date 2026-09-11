// routes/purchases.js - record stock purchases (restocking)
const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

router.get('/', (req, res) => {
  const purchases = db.prepare(
    `SELECT pu.*, p.name AS product_name FROM purchases pu
     JOIN products p ON p.id = pu.product_id
     WHERE pu.user_id = ? ORDER BY pu.purchase_date DESC LIMIT 200`
  ).all(req.userId);
  res.json(purchases);
});

router.post('/', (req, res) => {
  const { product_id, quantity, purchase_price } = req.body;
  if (!product_id || !quantity) return res.status(400).json({ error: 'product_id and quantity required' });

  const product = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(product_id, req.userId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const price = purchase_price ?? product.cost_price;

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO purchases (user_id, product_id, quantity, purchase_price) VALUES (?, ?, ?, ?)')
      .run(req.userId, product_id, quantity, price);
    db.prepare(`UPDATE products SET quantity = quantity + ?, cost_price = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(quantity, price, product_id);
  });
  tx();

  res.status(201).json({ message: 'Purchase recorded' });
});

module.exports = router;
