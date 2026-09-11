// routes/orders.js - cart checkout, vendor alerts, delivery status, and billing.
//
// Flow implemented here (matches the product requirements):
//  1. Customer adds items from ONE shop's product list to their cart, then
//     checks out -> POST /orders creates the order + a HIGH priority
//     notification for that shop's vendor, and reserves the stock.
//  2. Vendor sees the incoming order (with a high-alert flag) via
//     GET /orders/incoming, can move it through statuses, and generates the
//     final bill with PUT /orders/:id/bill. Generating the bill records a
//     "sale" for each item so it shows up in the vendor's analytics.
//  3. Vendor marks the order delivered with PUT /orders/:id/status.
const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

const DELIVERY_FEE = 25;
const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];

router.use(authRequired);

function requireRole(role) {
  return (req, res, next) => {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
    if (!user || user.role !== role) {
      return res.status(403).json({ error: `Only ${role}s can do this` });
    }
    next();
  };
}

function loadOrderWithItems(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  return { ...order, items };
}

// POST /orders - customer places a cart order with a single vendor
router.post('/', requireRole('customer'), (req, res) => {
  const { vendor_id, items, delivery_address } = req.body;

  if (!vendor_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'vendor_id and a non-empty items array are required' });
  }

  const vendor = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'vendor'").get(vendor_id);
  if (!vendor) return res.status(404).json({ error: 'Shop not found' });

  // Validate every item belongs to this vendor and has enough stock.
  const resolvedItems = [];
  for (const item of items) {
    const product = db
      .prepare('SELECT * FROM products WHERE id = ? AND user_id = ?')
      .get(item.product_id, vendor_id);
    if (!product) {
      return res.status(400).json({ error: `Item ${item.product_id} is not sold by this shop` });
    }
    if (product.quantity < item.quantity) {
      return res.status(400).json({ error: `Only ${product.quantity} ${product.unit} of ${product.name} left` });
    }
    resolvedItems.push({ product, quantity: item.quantity });
  }

  const subtotal = resolvedItems.reduce((sum, i) => sum + i.product.selling_price * i.quantity, 0);
  const deliveryFee = DELIVERY_FEE;
  const total = subtotal + deliveryFee;

  const order = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO orders (customer_id, vendor_id, status, subtotal, delivery_fee, total, delivery_address)
         VALUES (?, ?, 'pending', ?, ?, ?, ?)`
      )
      .run(req.userId, vendor_id, subtotal, deliveryFee, total, delivery_address || '');

    const orderId = info.lastInsertRowid;

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
       VALUES (?, ?, ?, ?, ?)`
    );
    const reserveStock = db.prepare(
      `UPDATE products SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ?`
    );

    for (const i of resolvedItems) {
      insertItem.run(orderId, i.product.id, i.product.name, i.quantity, i.product.selling_price);
      reserveStock.run(i.quantity, i.product.id);
    }

    const customer = db.prepare('SELECT name, phone FROM users WHERE id = ?').get(req.userId);
    db.prepare(
      `INSERT INTO notifications (user_id, order_id, type, priority, message)
       VALUES (?, ?, 'new_order', 'high', ?)`
    ).run(
      vendor_id,
      orderId,
      `New order #${orderId} from ${customer.name || customer.phone} - ${resolvedItems.length} item(s), ₹${total.toFixed(2)}`
    );

    return orderId;
  })();

  res.status(201).json(loadOrderWithItems(order));
});

// GET /orders/my - customer's own order history
router.get('/my', requireRole('customer'), (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC')
    .all(req.userId);
  const withItems = orders.map((o) => ({
    ...o,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id),
  }));
  res.json(withItems);
});

// GET /orders/incoming - vendor's incoming orders, most recent first
router.get('/incoming', requireRole('vendor'), (req, res) => {
  const orders = db
    .prepare(
      `SELECT o.*, u.name AS customer_name, u.phone AS customer_phone
       FROM orders o JOIN users u ON u.id = o.customer_id
       WHERE o.vendor_id = ? ORDER BY o.created_at DESC`
    )
    .all(req.userId);
  const withItems = orders.map((o) => ({
    ...o,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id),
  }));
  res.json(withItems);
});

// PUT /orders/:id/status - vendor updates order/delivery status
router.put('/:id/status', requireRole('vendor'), (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND vendor_id = ?').get(req.params.id, req.userId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, order.id);
  res.json(loadOrderWithItems(order.id));
});

// PUT /orders/:id/bill - vendor generates the final bill for an order.
// Records each line item as a sale (so it feeds the existing /analytics
// endpoints) and marks the order billed.
router.put('/:id/bill', requireRole('vendor'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND vendor_id = ?').get(req.params.id, req.userId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.bill_generated_at) {
    return res.status(409).json({ error: 'Bill already generated for this order', order: loadOrderWithItems(order.id) });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

  db.transaction(() => {
    const insertSale = db.prepare(
      'INSERT INTO sales (user_id, product_id, quantity, sale_price) VALUES (?, ?, ?, ?)'
    );
    for (const item of items) {
      insertSale.run(req.userId, item.product_id, item.quantity, item.unit_price);
    }
    db.prepare(
      `UPDATE orders SET bill_generated_at = datetime('now'), status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END, updated_at = datetime('now')
       WHERE id = ?`
    ).run(order.id);
  })();

  res.json(loadOrderWithItems(order.id));
});

module.exports = router;
