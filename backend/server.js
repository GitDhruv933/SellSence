// server.js - entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const purchaseRoutes = require('./routes/purchases');
const analyticsRoutes = require('./routes/analytics');
const aiRoutes = require('./routes/ai');
const shopRoutes = require('./routes/shops');
const orderRoutes = require('./routes/orders');
const notificationRoutes = require('./routes/notifications');
const wardAnalysisRoutes = require('./routes/wardAnalysis');
const businessReportRoutes = require('./routes/businessReport');
const financialCalculatorRoutes = require('./routes/financialCalculator');
const reviewRoutes = require('./routes/reviews');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/sales', salesRoutes);
app.use('/purchases', purchaseRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/ai', aiRoutes);
app.use('/shops', shopRoutes);
app.use('/orders', orderRoutes);
app.use('/notifications', notificationRoutes);
app.use('/ward-analysis', wardAnalysisRoutes);
app.use('/business-report', businessReportRoutes);
app.use('/financial-calculator', financialCalculatorRoutes);
app.use('/reviews', reviewRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Vendor Inventory API running on port ${PORT}`));
