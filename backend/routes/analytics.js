// routes/analytics.js - revenue, profit/loss, restock suggestions, and new visualizations
const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

function getDays(req) {
  const d = parseInt(req.query.days, 10);
  return Number.isFinite(d) && d > 0 ? d : 30;
}

// GET /analytics/today
// True "today" revenue (calendar day), cost, and units sold.
router.get('/today', (req, res) => {
  const row = db.prepare(
    `SELECT
       COALESCE(SUM(s.quantity * s.sale_price), 0) AS revenue,
       COALESCE(SUM(s.quantity * p.cost_price), 0) AS cost,
       COALESCE(SUM(s.quantity), 0) AS units_sold,
       COUNT(DISTINCT s.id) AS transactions
     FROM sales s
     JOIN products p ON p.id = s.product_id
     WHERE s.user_id = ? AND date(s.sale_date) = date('now')`
  ).get(req.userId);

  const profit = row.revenue - row.cost;
  res.json({
    revenue: row.revenue,
    cost_of_goods: row.cost,
    profit_or_loss: profit,
    status: profit >= 0 ? 'profit' : 'loss',
    units_sold: row.units_sold,
    transactions: row.transactions
  });
});

// GET /analytics/summary?days=30
router.get('/summary', (req, res) => {
  const days = getDays(req);
  const row = db.prepare(
    `SELECT
       COALESCE(SUM(s.quantity * s.sale_price), 0) AS revenue,
       COALESCE(SUM(s.quantity * p.cost_price), 0) AS cost,
       COALESCE(SUM(s.quantity), 0) AS units_sold
     FROM sales s
     JOIN products p ON p.id = s.product_id
     WHERE s.user_id = ? AND s.sale_date >= datetime('now', ?)`
  ).get(req.userId, `-${days} days`);

  const profit = row.revenue - row.cost;
  res.json({
    period_days: days,
    revenue: row.revenue,
    cost_of_goods: row.cost,
    profit_or_loss: profit,
    status: profit >= 0 ? 'profit' : 'loss',
    units_sold: row.units_sold
  });
});

// GET /analytics/weekly-comparison
// This week (Sun-Sat) vs last week revenue + order count.
router.get('/weekly-comparison', (req, res) => {
  const thisWeek = db.prepare(
    `SELECT
       COALESCE(SUM(s.quantity * s.sale_price), 0) AS revenue,
       COUNT(DISTINCT s.id) AS transactions
     FROM sales s
     WHERE s.user_id = ? AND s.sale_date >= datetime('now', 'weekday 0', '-7 days')`
  ).get(req.userId);

  const lastWeek = db.prepare(
    `SELECT
       COALESCE(SUM(s.quantity * s.sale_price), 0) AS revenue,
       COUNT(DISTINCT s.id) AS transactions
     FROM sales s
     WHERE s.user_id = ? AND s.sale_date >= datetime('now', 'weekday 0', '-14 days')
       AND s.sale_date < datetime('now', 'weekday 0', '-7 days')`
  ).get(req.userId);

  const thisWeekOrders = db.prepare(
    `SELECT COUNT(*) AS count FROM orders WHERE vendor_id = ? AND created_at >= datetime('now', 'weekday 0', '-7 days')`
  ).get(req.userId);

  const lastWeekOrders = db.prepare(
    `SELECT COUNT(*) AS count FROM orders WHERE vendor_id = ? AND created_at >= datetime('now', 'weekday 0', '-14 days')
     AND created_at < datetime('now', 'weekday 0', '-7 days')`
  ).get(req.userId);

  const revenueChange = lastWeek.revenue > 0
    ? ((thisWeek.revenue - lastWeek.revenue) / lastWeek.revenue) * 100
    : (thisWeek.revenue > 0 ? 100 : 0);

  const orderChange = lastWeekOrders.count > 0
    ? ((thisWeekOrders.count - lastWeekOrders.count) / lastWeekOrders.count) * 100
    : (thisWeekOrders.count > 0 ? 100 : 0);

  res.json({
    this_week: { revenue: thisWeek.revenue, transactions: thisWeek.transactions, orders: thisWeekOrders.count },
    last_week: { revenue: lastWeek.revenue, transactions: lastWeek.transactions, orders: lastWeekOrders.count },
    revenue_change_pct: Number(revenueChange.toFixed(1)),
    order_change_pct: Number(orderChange.toFixed(1)),
  });
});

// GET /analytics/by-product?days=30
router.get('/by-product', (req, res) => {
  const days = getDays(req);
  const rows = db.prepare(
    `SELECT p.id, p.name, p.category,
       COALESCE(SUM(s.quantity), 0) AS units_sold,
       COALESCE(SUM(s.quantity * s.sale_price), 0) AS revenue,
       COALESCE(SUM(s.quantity * p.cost_price), 0) AS cost
     FROM products p
     LEFT JOIN sales s ON s.product_id = p.id AND s.sale_date >= datetime('now', ?)
     WHERE p.user_id = ?
     GROUP BY p.id
     ORDER BY revenue DESC`
  ).all(`-${days} days`, req.userId);

  res.json(rows.map(r => ({ ...r, profit: r.revenue - r.cost })));
});

// GET /analytics/profit-margin?days=30
router.get('/profit-margin', (req, res) => {
  const days = getDays(req);
  const rows = db.prepare(
    `SELECT p.id, p.name,
       COALESCE(SUM(s.quantity * s.sale_price), 0) AS revenue,
       COALESCE(SUM(s.quantity * p.cost_price), 0) AS cost
     FROM products p
     LEFT JOIN sales s ON s.product_id = p.id AND s.sale_date >= datetime('now', ?)
     WHERE p.user_id = ?
     GROUP BY p.id
     HAVING revenue > 0
     ORDER BY (revenue - cost) / NULLIF(revenue, 0) DESC`
  ).all(`-${days} days`, req.userId);

  res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    revenue: r.revenue,
    cost: r.cost,
    profit: r.revenue - r.cost,
    margin_pct: Number((((r.revenue - r.cost) / r.revenue) * 100).toFixed(1))
  })));
});

// GET /analytics/restock-suggestions?days=30
router.get('/restock-suggestions', (req, res) => {
  const days = getDays(req);
  const rows = db.prepare(
    `SELECT p.id, p.name, p.category, p.unit, p.quantity, p.reorder_level, p.cost_price,
       COALESCE(SUM(s.quantity), 0) AS units_sold_period
     FROM products p
     LEFT JOIN sales s ON s.product_id = p.id AND s.sale_date >= datetime('now', ?)
     WHERE p.user_id = ?
     GROUP BY p.id`
  ).all(`-${days} days`, req.userId);

  const suggestions = rows.map(r => {
    const dailyVelocity = r.units_sold_period / days;
    const daysOfStockLeft = dailyVelocity > 0 ? r.quantity / dailyVelocity : Infinity;
    const capitalTiedUp = r.quantity * r.cost_price;

    let action = 'maintain';
    let reason = 'Stock level looks balanced for current sales pace.';

    if (r.quantity <= r.reorder_level && dailyVelocity > 0) {
      action = 'buy_more';
      reason = `Selling ~${dailyVelocity.toFixed(1)}/day and only ${r.quantity} ${r.unit} left (~${daysOfStockLeft.toFixed(0)} days of stock).`;
    } else if (dailyVelocity === 0 && r.quantity > 0) {
      action = 'buy_less';
      reason = `No sales in the last ${days} days but ${r.quantity} ${r.unit} in stock — capital tied up, consider a discount or pausing purchases.`;
    } else if (daysOfStockLeft > days * 2 && r.quantity > r.reorder_level) {
      action = 'buy_less';
      reason = `At the current sales pace this stock will last ~${daysOfStockLeft.toFixed(0)} days — you're overstocked, buy less next time.`;
    } else if (r.quantity <= r.reorder_level) {
      action = 'buy_more';
      reason = `Stock (${r.quantity} ${r.unit}) is at or below your reorder level of ${r.reorder_level}.`;
    }

    return {
      product_id: r.id,
      name: r.name,
      category: r.category,
      quantity: r.quantity,
      units_sold_period: r.units_sold_period,
      daily_velocity: Number(dailyVelocity.toFixed(2)),
      days_of_stock_left: Number.isFinite(daysOfStockLeft) ? Number(daysOfStockLeft.toFixed(1)) : null,
      capital_tied_up: Number(capitalTiedUp.toFixed(2)),
      action,
      reason
    };
  });

  suggestions.sort((a, b) => {
    const order = { buy_more: 0, buy_less: 1, maintain: 2 };
    return order[a.action] - order[b.action];
  });

  res.json(suggestions);
});

// GET /analytics/stock-trend?days=30
router.get('/stock-trend', (req, res) => {
  const days = getDays(req);

  const totalNowRow = db.prepare(
    'SELECT COALESCE(SUM(quantity), 0) AS total FROM products WHERE user_id = ?'
  ).get(req.userId);
  const totalNow = totalNowRow.total;

  const purchaseRows = db.prepare(
    `SELECT date(purchase_date) AS day, COALESCE(SUM(quantity), 0) AS qty
     FROM purchases WHERE user_id = ? AND purchase_date >= datetime('now', ?)
     GROUP BY day`
  ).all(req.userId, `-${days} days`);

  const saleRows = db.prepare(
    `SELECT date(sale_date) AS day, COALESCE(SUM(quantity), 0) AS qty
     FROM sales WHERE user_id = ? AND sale_date >= datetime('now', ?)
     GROUP BY day`
  ).all(req.userId, `-${days} days`);

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

  res.json(trend);
});

// GET /analytics/daily?days=7
// Revenue per calendar day for the last N days.
router.get('/daily', (req, res) => {
  const days = getDays(req);
  const rows = db.prepare(
    `SELECT date(s.sale_date) AS day,
       COALESCE(SUM(s.quantity * s.sale_price), 0) AS revenue,
       COALESCE(SUM(s.quantity * p.cost_price), 0) AS cost
     FROM sales s
     JOIN products p ON p.id = s.product_id
     WHERE s.user_id = ? AND s.sale_date >= datetime('now', ?)
     GROUP BY day`
  ).all(req.userId, `-${days} days`);

  const byDay = {};
  rows.forEach(r => { byDay[r.day] = { revenue: r.revenue, cost: r.cost, profit: r.revenue - r.cost }; });

  const dayList = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayList.push(d.toISOString().slice(0, 10));
  }

  const dayName = (d) => new Date(d + 'T00:00:00').toLocaleString('en-US', { weekday: 'short' });

  res.json(dayList.map(day => ({
    day: dayName(day),
    fullDate: day,
    revenue: Math.round(byDay[day]?.revenue || 0),
    cost: Math.round(byDay[day]?.cost || 0),
    profit: Math.round(byDay[day]?.profit || 0),
  })));
});

// GET /analytics/category-breakdown?days=30
router.get('/category-breakdown', (req, res) => {
  const days = getDays(req);
  const rows = db.prepare(
    `SELECT COALESCE(NULLIF(p.category, ''), 'Uncategorized') AS category,
       COALESCE(SUM(s.quantity * s.sale_price), 0) AS revenue,
       COALESCE(SUM(s.quantity), 0) AS units
     FROM sales s
     JOIN products p ON p.id = s.product_id
     WHERE s.user_id = ? AND s.sale_date >= datetime('now', ?)
     GROUP BY category
     HAVING revenue > 0
     ORDER BY revenue DESC`
  ).all(req.userId, `-${days} days`);

  const total = rows.reduce((s, r) => s + r.revenue, 0);
  res.json(rows.map(r => ({
    category: r.category,
    revenue: r.revenue,
    units: r.units,
    pct: Number(((r.revenue / total) * 100).toFixed(1))
  })));
});

// GET /analytics/order-status
router.get('/order-status', (req, res) => {
  const rows = db.prepare(
    `SELECT status, COUNT(*) AS count FROM orders WHERE vendor_id = ? GROUP BY status`
  ).all(req.userId);

  const statusMap = { pending: 0, confirmed: 0, preparing: 0, out_for_delivery: 0, delivered: 0, cancelled: 0 };
  rows.forEach(r => { statusMap[r.status] = r.count; });
  res.json(statusMap);
});

// GET /analytics/monthly?months=6
// Fixed: predicted is now a real simple linear regression forecast, not a copy of sales.
router.get('/monthly', (req, res) => {
  const monthsParam = parseInt(req.query.months, 10);
  const months = Number.isFinite(monthsParam) && monthsParam > 0 ? monthsParam : 6;

  // Pull up to 12 months of history so we can forecast from a longer baseline
  const historyMonths = Math.max(months, 12);
  const rows = db.prepare(
    `SELECT strftime('%Y-%m', s.sale_date) AS ym, COALESCE(SUM(s.quantity * s.sale_price), 0) AS revenue
     FROM sales s
     WHERE s.user_id = ? AND s.sale_date >= datetime('now', ?)
     GROUP BY ym`
  ).all(req.userId, `-${historyMonths} months`);

  const byMonth = {};
  rows.forEach((r) => { byMonth[r.ym] = r.revenue; });

  const labels = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    labels.push(d.toISOString().slice(0, 7));
  }

  const monthName = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleString('en-US', { month: 'short' });

  // Build full historical series for regression (oldest first)
  const allLabels = [];
  for (let i = historyMonths - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    allLabels.push(d.toISOString().slice(0, 7));
  }
  const historicalSales = allLabels.map(ym => byMonth[ym] || 0);

  // Simple linear regression on the historical data
  const n = historicalSales.length;
  const sumX = historicalSales.reduce((s, _, i) => s + i, 0);
  const sumY = historicalSales.reduce((s, v) => s + v, 0);
  const sumXY = historicalSales.reduce((s, v, i) => s + i * v, 0);
  const sumX2 = historicalSales.reduce((s, _, i) => s + i * i, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = denom !== 0 ? (sumY - slope * sumX) / n : sumY / n;

  const forecastForIndex = (idx) => Math.max(0, Math.round(slope * idx + intercept));

  // The index for the first displayed month within the full history
  const offset = historyMonths - months;

  const series = labels.map((ym, idx) => {
    const actual = Math.round(byMonth[ym] || 0);
    const predicted = forecastForIndex(offset + idx);
    return {
      month: monthName(ym),
      sales: actual,
      predicted,
    };
  });

  res.json(series);
});

module.exports = router;
