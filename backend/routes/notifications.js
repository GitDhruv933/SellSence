// routes/notifications.js - vendor alert inbox (e.g. "high" priority new-order alerts)
const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

// GET /notifications?unread=1
router.get('/', (req, res) => {
  const onlyUnread = req.query.unread === '1' || req.query.unread === 'true';
  const query = onlyUnread
    ? 'SELECT * FROM notifications WHERE user_id = ? AND read = 0 ORDER BY created_at DESC'
    : 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100';
  const notifications = db.prepare(query).all(req.userId);
  res.json(notifications);
});

router.put('/:id/read', (req, res) => {
  const info = db
    .prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Notification not found' });
  res.json({ message: 'Marked as read' });
});

router.put('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.userId);
  res.json({ message: 'All marked as read' });
});

module.exports = router;
