// routes/shops.js - public browsing for customers: nearby shops + their items.
// No auth required, since a customer needs to see shops before creating an account.
const express = require('express');
const db = require('../db');
const router = express.Router();

// Haversine distance in km between two lat/lng points.
function distanceKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => v === null || v === undefined || Number.isNaN(v))) {
    return null;
  }
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function stripPassword(user) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

// GET /shops?lat=..&lng=..&radius=5
// Returns every registered vendor, each with the number of items they sell,
// sorted by distance when the customer's location is provided.
router.get('/', (req, res) => {
  const lat = req.query.lat !== undefined ? parseFloat(req.query.lat) : null;
  const lng = req.query.lng !== undefined ? parseFloat(req.query.lng) : null;
  const radius = req.query.radius !== undefined ? parseFloat(req.query.radius) : null;

  const vendors = db.prepare("SELECT * FROM users WHERE role = 'vendor'").all();

  let shops = vendors.map((v) => {
    const itemCount = db.prepare('SELECT COUNT(*) AS c FROM products WHERE user_id = ?').get(v.id).c;
    const dist = distanceKm(lat, lng, v.latitude, v.longitude);
    return {
      ...stripPassword(v),
      item_count: itemCount,
      distance_km: dist !== null ? Number(dist.toFixed(2)) : null,
    };
  });

  if (radius) {
    shops = shops.filter((s) => s.distance_km === null || s.distance_km <= radius);
  }

  shops.sort((a, b) => {
    if (a.distance_km === null) return 1;
    if (b.distance_km === null) return -1;
    return a.distance_km - b.distance_km;
  });

  res.json(shops);
});

// GET /shops/:id - shop details + full item list, for the customer's shop page.
router.get('/:id', (req, res) => {
  const vendor = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'vendor'").get(req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Shop not found' });

  const products = db
    .prepare('SELECT * FROM products WHERE user_id = ? AND quantity > 0 ORDER BY name')
    .all(req.params.id);

  const ratingStmt = db.prepare(
    `SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS average FROM reviews WHERE product_id = ?`
  );
  const withRatings = products.map((p) => {
    const r = ratingStmt.get(p.id);
    return {
      ...p,
      avg_rating: r.count > 0 ? Number(r.average.toFixed(2)) : 0,
      review_count: r.count,
    };
  });

  res.json({ shop: stripPassword(vendor), products: withRatings });
});

module.exports = router;
