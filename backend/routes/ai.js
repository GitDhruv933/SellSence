// routes/ai.js - AI shop assistant. Uses Claude API if ANTHROPIC_API_KEY is set,
// otherwise falls back to rule-based tips generated from the vendor's own data.
const express = require('express');
const fetch = require('node-fetch');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

// --- Simple in-memory conversation history (last 20 messages per user) ---
const conversationStore = new Map(); // userId -> { messages: [{role, content, ts}], lastAccess }
const MAX_HISTORY = 20;
const STORE_TTL_MS = 1000 * 60 * 60 * 2; // 2 hours

function getHistory(userId) {
  const entry = conversationStore.get(userId);
  if (!entry) return [];
  if (Date.now() - entry.lastAccess > STORE_TTL_MS) {
    conversationStore.delete(userId);
    return [];
  }
  return entry.messages;
}

function pushHistory(userId, role, content) {
  if (!conversationStore.has(userId)) conversationStore.set(userId, { messages: [], lastAccess: Date.now() });
  const entry = conversationStore.get(userId);
  entry.messages.push({ role, content, ts: Date.now() });
  if (entry.messages.length > MAX_HISTORY) entry.messages = entry.messages.slice(-MAX_HISTORY);
  entry.lastAccess = Date.now();
}

function parseDaysFromMessage(message) {
  const lower = message.toLowerCase();
  const lastNMatch = lower.match(/last (\d+)\s*day/);
  if (lastNMatch) return parseInt(lastNMatch[1], 10);
  if (lower.includes('today')) return 1;
  if (lower.includes('this week') || lower.includes('past week') || lower.includes('last week')) return 7;
  if (lower.includes('this month') || lower.includes('past month') || lower.includes('last month')) return 30;
  return null;
}

function buildContext(userId, days) {
  const summary = db.prepare(
    `SELECT COALESCE(SUM(s.quantity*s.sale_price),0) AS revenue,
            COALESCE(SUM(s.quantity*p.cost_price),0) AS cost
     FROM sales s JOIN products p ON p.id = s.product_id
     WHERE s.user_id = ? AND s.sale_date >= datetime('now', ?)`
  ).get(userId, `-${days} days`);

  const lowStock = db.prepare(
    `SELECT name, quantity, unit, reorder_level FROM products
     WHERE user_id = ? AND quantity <= reorder_level`
  ).all(userId);

  const topSelling = db.prepare(
    `SELECT p.name, SUM(s.quantity) AS units FROM sales s
     JOIN products p ON p.id = s.product_id
     WHERE s.user_id = ? AND s.sale_date >= datetime('now', ?)
     GROUP BY p.id ORDER BY units DESC LIMIT 5`
  ).all(userId, `-${days} days`);

  const pendingOrders = db.prepare(
    `SELECT COUNT(*) AS count FROM orders WHERE vendor_id = ? AND status = 'pending'`
  ).get(userId);

  return { summary, lowStock, topSelling, pendingOrders };
}

// --- 1. Pie chart ---
function buildPieChart(message, userId, days) {
  const lower = message.toLowerCase();
  if (!lower.includes('pie')) return null;

  const wantsSales = lower.includes('sale') || lower.includes('revenue') || lower.includes('profit');

  if (wantsSales) {
    const rows = db.prepare(
      `SELECT COALESCE(NULLIF(p.category, ''), 'Uncategorized') AS category,
              COALESCE(SUM(s.quantity * s.sale_price), 0) AS value
       FROM sales s JOIN products p ON p.id = s.product_id
       WHERE s.user_id = ? AND s.sale_date >= datetime('now', ?)
       GROUP BY category HAVING value > 0
       ORDER BY value DESC`
    ).all(userId, `-${days} days`);
    if (rows.length === 0) {
      return { reply: `No sales recorded in the last ${days} days, so there's nothing to chart.`, chart: null };
    }
    return {
      reply: `Here's your revenue breakdown by category (last ${days} days):`,
      chart: { type: 'pie', title: `Revenue by Category — Last ${days} Days`, data: rows.map(r => ({ name: r.category, value: r.value })) }
    };
  }

  const rows = db.prepare(
    `SELECT COALESCE(NULLIF(category, ''), 'Uncategorized') AS category,
            COALESCE(SUM(quantity), 0) AS value
     FROM products WHERE user_id = ?
     GROUP BY category HAVING value > 0
     ORDER BY value DESC`
  ).all(userId);
  if (rows.length === 0) {
    return { reply: "No stock recorded yet, so there's nothing to chart.", chart: null };
  }
  return {
    reply: "Here's your current stock breakdown by category:",
    chart: { type: 'pie', title: 'Stock by Category', data: rows.map(r => ({ name: r.category, value: r.value })) }
  };
}

// --- 2. Bar chart ---
function buildBarChart(message, userId, days) {
  const lower = message.toLowerCase();
  const wantsBar = lower.includes('bar') && (lower.includes('chart') || lower.includes('top') || lower.includes('seller') || lower.includes('revenue') || lower.includes('product'));
  if (!wantsBar) return null;

  const rows = db.prepare(
    `SELECT p.id, p.name,
       COALESCE(SUM(s.quantity), 0) AS units_sold,
       COALESCE(SUM(s.quantity * s.sale_price), 0) AS revenue,
       COALESCE(SUM(s.quantity * p.cost_price), 0) AS cost
     FROM products p
     LEFT JOIN sales s ON s.product_id = p.id AND s.sale_date >= datetime('now', ?)
     WHERE p.user_id = ?
     GROUP BY p.id
     ORDER BY revenue DESC
     LIMIT 10`
  ).all(`-${days} days`, userId);

  if (rows.length === 0 || rows.every(r => r.revenue === 0)) {
    return { reply: `No sales recorded in the last ${days} days, so there's nothing to chart.`, chart: null };
  }

  return {
    reply: `Here's your top products by revenue (last ${days} days):`,
    chart: {
      type: 'bar',
      title: `Top Products — Last ${days} Days`,
      data: rows.map(r => ({ name: r.name, revenue: r.revenue, profit: r.revenue - r.cost }))
    }
  };
}

// --- 3. Line chart ---
function buildLineChart(message, userId, days) {
  const lower = message.toLowerCase();
  const wantsLine = (lower.includes('line') && (lower.includes('chart') || lower.includes('stock') || lower.includes('trend'))) || lower.includes('stock trend');
  if (!wantsLine) return null;

  const totalNowRow = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS total FROM products WHERE user_id = ?').get(userId);
  const totalNow = totalNowRow.total;

  const purchaseRows = db.prepare(
    `SELECT date(purchase_date) AS day, COALESCE(SUM(quantity), 0) AS qty
     FROM purchases WHERE user_id = ? AND purchase_date >= datetime('now', ?)
     GROUP BY day`
  ).all(userId, `-${days} days`);

  const saleRows = db.prepare(
    `SELECT date(sale_date) AS day, COALESCE(SUM(quantity), 0) AS qty
     FROM sales WHERE user_id = ? AND sale_date >= datetime('now', ?)
     GROUP BY day`
  ).all(userId, `-${days} days`);

  const netByDay = {};
  purchaseRows.forEach(r => { netByDay[r.day] = (netByDay[r.day] || 0) + r.qty; });
  saleRows.forEach(r => { netByDay[r.day] = (netByDay[r.day] || 0) - r.qty; });

  const dayList = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayList.push(d.toISOString().slice(0, 10));
  }

  const totalNetOverPeriod = dayList.reduce((sum, day) => sum + (netByDay[day] || 0), 0);
  let running = totalNow - totalNetOverPeriod;

  const trend = dayList.map(day => {
    running += netByDay[day] || 0;
    return { date: day, stock: Math.max(0, Math.round(running)) };
  });

  return {
    reply: `Here's your total stock level over the last ${days} days:`,
    chart: { type: 'line', title: `Total Stock — Last ${days} Days`, data: trend }
  };
}

// --- 4. Reorder list ---
function buildReorderList(message, userId, days) {
  const lower = message.toLowerCase();
  const wantsReorder = lower.includes('reorder') || lower.includes('purchase order') ||
    (lower.includes('buy') && (lower.includes('what') || lower.includes('week') || lower.includes('should')));
  if (!wantsReorder) return null;

  const rows = db.prepare(
    `SELECT p.id, p.name, p.unit, p.quantity, p.reorder_level,
       COALESCE(SUM(s.quantity), 0) AS units_sold_period
     FROM products p
     LEFT JOIN sales s ON s.product_id = p.id AND s.sale_date >= datetime('now', ?)
     WHERE p.user_id = ?
     GROUP BY p.id`
  ).all(`-${days} days`, userId);

  const needsReorder = rows.filter(r => r.quantity <= r.reorder_level);
  if (needsReorder.length === 0) {
    return { reply: 'Nothing needs reordering right now — all stock is above the reorder level. 👍' };
  }

  const items = needsReorder.map(r => {
    const dailyVelocity = r.units_sold_period / days;
    const target = Math.max(r.reorder_level * 2, Math.ceil(dailyVelocity * 14));
    const suggestedQty = Math.max(target - r.quantity, 1);
    return `${r.name} — buy ${suggestedQty} ${r.unit} (have ${r.quantity}, reorder level ${r.reorder_level})`;
  });

  return { reply: `Here's a suggested reorder list: ${items.join('; ')}.` };
}

// --- 5. Product lookup ---
function buildProductLookup(message, userId) {
  const lower = message.toLowerCase();
  const products = db.prepare('SELECT name, unit, quantity, selling_price FROM products WHERE user_id = ?').all(userId);
  if (products.length === 0) return null;

  const sorted = [...products].sort((a, b) => b.name.length - a.name.length);
  const matched = sorted.find(p => lower.includes(p.name.toLowerCase()));
  if (!matched) return null;

  const wantsPrice = lower.includes('price') || lower.includes('cost');
  const wantsStock = lower.includes('how much') || lower.includes('stock') || lower.includes('left') || lower.includes('have');

  if (wantsPrice && !wantsStock) {
    return { reply: `${matched.name}: ₹${matched.selling_price} per ${matched.unit}.` };
  }
  if (wantsStock && !wantsPrice) {
    return { reply: `${matched.name}: ${matched.quantity} ${matched.unit} in stock.` };
  }
  return { reply: `${matched.name}: ${matched.quantity} ${matched.unit} in stock, priced at ₹${matched.selling_price} per ${matched.unit}.` };
}

const fallbackReplies = [
  "I can help with your profit/loss, which items are low on stock, or your best-selling products this month — just ask.",
  "Try asking things like: \"what's my profit this month\", \"what's low on stock\", \"top sellers\", or \"pie chart of my stock by category\".",
  "I'm best with profit/loss, low stock alerts, best sellers, reorder lists, and charts — what would you like to know?"
];
function pickFallback() {
  return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
}

function ruleBasedReply(message, ctx, days) {
  const lower = message.toLowerCase().trim();
  const profit = ctx.summary.revenue - ctx.summary.cost;

  if (/^(hi|hello|hey|namaste|yo)\b/.test(lower)) {
    return 'Hi! Ask me about profit/loss, low stock, best sellers, reorder lists, or say "pie chart of my stock" for a chart.';
  }
  if (/^(yes|yeah|yep|sure|ok|okay|pls|please)\b/.test(lower) && lower.split(' ').length <= 3) {
    return 'Great — try something specific like "what\'s my profit this month" or "pie chart of my sales by category".';
  }
  if (lower.includes('help') || lower.includes('guide') || lower.includes('what can you')) {
    return 'I can tell you your profit/loss, which items are low on stock, your best sellers, draft a reorder list, or draw a pie/bar/line chart — just ask!';
  }
  if (lower.includes('summary') || lower.includes('daily report') || (lower.includes('how') && lower.includes('shop'))) {
    const lowCount = ctx.lowStock.length;
    const topName = ctx.topSelling[0]?.name;
    return `Quick summary — profit (last ${days} days): ₹${profit.toFixed(0)}; ${lowCount} item(s) need restocking; top seller: ${topName || 'no sales yet'}; ${ctx.pendingOrders.count} pending order(s).`;
  }
  if (lower.includes('profit') || lower.includes('loss')) {
    return `In the last ${days} days: revenue ₹${ctx.summary.revenue.toFixed(0)}, cost ₹${ctx.summary.cost.toFixed(0)}, ${profit >= 0 ? 'profit' : 'loss'} ₹${Math.abs(profit).toFixed(0)}.`;
  }
  if (lower.includes('stock') || lower.includes('buy') || lower.includes('running low') || lower.includes('running out')) {
    if (ctx.lowStock.length === 0) return 'All your products are above their reorder level right now. 👍';
    return `Low on stock: ${ctx.lowStock.map(p => `${p.name} (${p.quantity} ${p.unit} left)`).join(', ')}.`;
  }
  if (lower.includes('best') || lower.includes('top') || lower.includes('selling')) {
    if (ctx.topSelling.length === 0) return `No sales recorded in the last ${days} days yet.`;
    return `Your top sellers (last ${days} days): ${ctx.topSelling.map(p => `${p.name} (${p.units} sold)`).join(', ')}.`;
  }
  if (lower.includes('order') && (lower.includes('pending') || lower.includes('new'))) {
    return `You have ${ctx.pendingOrders.count} pending order(s) right now.`;
  }
  return pickFallback();
}

router.post('/chat', async (req, res) => {
  const { message, language } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const days = parseDaysFromMessage(message) || 30;

  // --- Deterministic features first ---
  const pie = buildPieChart(message, req.userId, days);
  if (pie) return res.json({ ...pie, source: 'chart' });

  const bar = buildBarChart(message, req.userId, days);
  if (bar) return res.json({ ...bar, source: 'chart' });

  const line = buildLineChart(message, req.userId, days);
  if (line) return res.json({ ...line, source: 'chart' });

  const reorder = buildReorderList(message, req.userId, days);
  if (reorder) return res.json({ ...reorder, source: 'reorder' });

  const lookup = buildProductLookup(message, req.userId);
  if (lookup) return res.json({ ...lookup, source: 'lookup' });

  const ctx = buildContext(req.userId, days);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Build conversation history for context
  const history = getHistory(req.userId);
  const recentHistory = history.slice(-6); // last 3 exchanges

  if (!apiKey) {
    const reply = ruleBasedReply(message, ctx, days);
    pushHistory(req.userId, 'user', message);
    pushHistory(req.userId, 'assistant', reply);
    return res.json({ reply, source: 'rule-based' });
  }

  try {
    const systemPrompt = `You are a helpful assistant for a small shop vendor in India using an inventory app.
Reply in ${language || 'English'}, in short, simple, practical sentences (this vendor is busy).
Use ₹ for currency. Here is the vendor's current data as context:
Last ${days} days revenue: ₹${ctx.summary.revenue}, cost: ₹${ctx.summary.cost}, profit/loss: ₹${(ctx.summary.revenue - ctx.summary.cost).toFixed(0)}.
Low stock items: ${JSON.stringify(ctx.lowStock)}.
Top selling items (last ${days} days): ${JSON.stringify(ctx.topSelling)}.
Pending orders: ${ctx.pendingOrders.count}.
Answer the vendor's question using this data when relevant. Keep replies under 3 sentences.`;

    const messages = [
      ...recentHistory.map(h => ({ role: h.role === 'ai' ? 'assistant' : h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    // Use a valid, current Anthropic model name
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        system: systemPrompt,
        messages
      })
    });

    const data = await response.json();
    let reply = '';
    if (data?.content && Array.isArray(data.content)) {
      reply = data.content.map(b => b.text).filter(Boolean).join('\n');
    }
    if (!reply) {
      reply = ruleBasedReply(message, ctx, days);
    }

    pushHistory(req.userId, 'user', message);
    pushHistory(req.userId, 'assistant', reply);
    res.json({ reply, source: 'ai' });
  } catch (err) {
    console.error('AI chat error:', err);
    const reply = ruleBasedReply(message, ctx, days);
    pushHistory(req.userId, 'user', message);
    pushHistory(req.userId, 'assistant', reply);
    res.json({ reply, source: 'rule-based-fallback' });
  }
});

module.exports = router;
