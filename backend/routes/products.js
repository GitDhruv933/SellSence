// routes/products.js - Inventory CRUD
const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

router.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE user_id = ? ORDER BY name').all(req.userId);
  res.json(products);
});

router.post('/', (req, res) => {
  const { name, category, unit, cost_price, selling_price, quantity, reorder_level, image_url } = req.body;
  if (!name) return res.status(400).json({ error: 'Product name required' });
  const info = db.prepare(
    `INSERT INTO products (user_id, name, category, unit, cost_price, selling_price, quantity, reorder_level, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.userId, name, category || '', unit || 'pc', cost_price || 0, selling_price || 0, quantity || 0, reorder_level || 5, image_url || '');
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(product);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  const { name, category, unit, cost_price, selling_price, quantity, reorder_level, image_url } = req.body;
  db.prepare(
    `UPDATE products SET name=?, category=?, unit=?, cost_price=?, selling_price=?, quantity=?, reorder_level=?, image_url=?, updated_at=datetime('now')
     WHERE id=? AND user_id=?`
  ).run(
    name ?? existing.name,
    category ?? existing.category,
    unit ?? existing.unit,
    cost_price ?? existing.cost_price,
    selling_price ?? existing.selling_price,
    quantity ?? existing.quantity,
    reorder_level ?? existing.reorder_level,
    image_url ?? existing.image_url,
    req.params.id,
    req.userId
  );
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ message: 'Deleted' });
});

module.exports = router;
