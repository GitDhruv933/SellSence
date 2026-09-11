// routes/auth.js - Phone number + password based login, for both customers and vendors
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

const PHONE_REGEX = /^\+?[0-9]{10,13}$/;

function stripPassword(user) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

// Create a new account. role: 'customer' | 'vendor'.
// Vendors should also send shop_name, shop_category, address, latitude, longitude
// so they can show up in nearby-shop search for customers.
router.post('/signup', async (req, res) => {
  const {
    phone,
    password,
    name,
    role,
    shop_name,
    shop_category,
    address,
    latitude,
    longitude,
    language,
  } = req.body;

  if (!phone || !PHONE_REGEX.test(phone)) {
    return res.status(400).json({ error: 'Enter a valid phone number' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const finalRole = role === 'vendor' ? 'vendor' : 'customer';
  if (finalRole === 'vendor' && !shop_name) {
    return res.status(400).json({ error: 'Shop name is required for vendor accounts' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existing) {
    return res.status(409).json({ error: 'An account with this phone number already exists. Please log in instead.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const info = db.prepare(
    `INSERT INTO users (phone, password_hash, name, role, shop_name, shop_category, address, latitude, longitude, language)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    phone,
    passwordHash,
    name || '',
    finalRole,
    shop_name || '',
    shop_category || '',
    address || '',
    latitude ?? null,
    longitude ?? null,
    language || 'en'
  );

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '30d' });

  res.status(201).json({ token, user: stripPassword(user) });
});

// Log in to an existing account
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: 'phone and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'No account found with this phone number' });
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '30d' });
  res.json({ token, user: stripPassword(user) });
});

// Update the caller's own profile - customers use this to save their delivery
// location, vendors use it to update shop details/location.
router.put('/me', authRequired, (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!existing) return res.status(404).json({ error: 'User not found' });

  const { name, shop_name, shop_category, address, latitude, longitude, language } = req.body;
  db.prepare(
    `UPDATE users SET name=?, shop_name=?, shop_category=?, address=?, latitude=?, longitude=?, language=?
     WHERE id=?`
  ).run(
    name ?? existing.name,
    shop_name ?? existing.shop_name,
    shop_category ?? existing.shop_category,
    address ?? existing.address,
    latitude ?? existing.latitude,
    longitude ?? existing.longitude,
    language ?? existing.language,
    req.userId
  );

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json({ user: stripPassword(user) });
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: stripPassword(user) });
});

module.exports = router;
