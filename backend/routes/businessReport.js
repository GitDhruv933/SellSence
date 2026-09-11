// routes/businessReport.js - Module 1: Local Business Report.
//
// Computes what's actually measurable from the app's own data (nearby
// customer count, competitor mapping, category-gap "missing opportunities"),
// then hands those real numbers to Claude (or a rule-based template if no
// API key is set) to write the SWOT analysis, local risks, and pricing
// narrative - so the AI is grounded in real numbers instead of inventing
// them.
const express = require('express');
const fetch = require('node-fetch');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

// A curated list of common hyperlocal shop types, used only to spot gaps
// ("nothing like this nearby yet") - not an official business-category
// registry of any kind.
const CANONICAL_CATEGORIES = [
  'grocery/kirana', 'pharmacy', 'vegetables & fruits', 'dairy', 'bakery',
  'stationery', 'electronics/mobile repair', 'hardware', 'salon/barber',
  'restaurant/food', 'clothing/fashion', 'laundry',
];

const CATEGORY_KEYWORDS = {
  'grocery/kirana': ['grocery', 'kirana', 'general store', 'supermarket'],
  pharmacy: ['pharmacy', 'medical', 'chemist', 'medicine'],
  'vegetables & fruits': ['vegetable', 'fruit', 'produce'],
  dairy: ['dairy', 'milk'],
  bakery: ['bakery', 'bread', 'cake'],
  stationery: ['stationery', 'books', 'printing'],
  'electronics/mobile repair': ['electronics', 'mobile', 'phone repair', 'gadget'],
  hardware: ['hardware', 'paint', 'plumbing', 'tools'],
  'salon/barber': ['salon', 'barber', 'beauty', 'parlour', 'parlor'],
  'restaurant/food': ['restaurant', 'food', 'tiffin', 'cafe', 'hotel', 'dhaba'],
  'clothing/fashion': ['clothing', 'fashion', 'apparel', 'garments', 'boutique'],
  laundry: ['laundry', 'dry clean', 'dhobi'],
};

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

function classifyCategory(freeText) {
  const lower = (freeText || '').toLowerCase();
  for (const [canonical, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return canonical;
  }
  return null; // doesn't match any known bucket - not counted toward gap analysis
}

function ruleBasedNarrative({ vendor, customersNear, customersFar, competitorCount, missing, pricing }) {
  return {
    swot: {
      strengths: [
        `Located within reach of ${customersNear + customersFar} registered nearby customers.`,
        competitorCount <= 1 ? 'Little direct competition in the same category nearby.' : 'Established category with proven local demand.',
      ],
      weaknesses: [
        competitorCount > 3 ? `${competitorCount} similar shops already compete for the same customers.` : 'Limited data so far to judge weaknesses precisely.',
      ],
      opportunities: missing.length > 0
        ? missing.slice(0, 3).map((c) => `No ${c} shop found nearby - possible category to add or a nearby gap to serve.`)
        : ['Most common categories are already represented nearby; differentiate on service or price instead.'],
      threats: [
        'Seasonal demand swings can hit revenue in off-peak months.',
        'Supply chain delays from distributors can cause stockouts.',
      ],
    },
    risks: [
      'Seasonal demand: sales for many local categories dip during monsoon/off-season - plan cash flow for slower months.',
      'Supply chain: a single-supplier dependency risks stockouts if that supplier delays or raises prices.',
      competitorCount > 3 ? 'Price competition: with several similar shops nearby, margins may get squeezed.' : 'New entrants: an underserved area can attract new competitors once demand is proven.',
    ],
    pricing_note: pricing.income_source === 'unavailable'
      ? 'Add an estimated local average income, or run Ward Analysis for this area, to get a pricing suggestion grounded in local income levels.'
      : `Based on ${pricing.income_source === 'ward_analysis' ? 'the ward analysis on file' : 'the income level you entered'}, a ${pricing.income_bracket} pricing approach is suggested (see the pricing section for suggested margins).`,
    source: 'rule-based',
  };
}

async function aiNarrative({ vendor, customersNear, customersFar, competitorCount, missing, present, pricing, language }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = `You are a local-market analyst helping a small shop owner in India understand their neighborhood.
Reply ONLY with valid JSON (no markdown fences, no commentary), matching exactly this shape:
{"swot": {"strengths": string[], "weaknesses": string[], "opportunities": string[], "threats": string[]}, "risks": string[], "pricing_note": string}
Keep every array to 2-4 short, concrete bullet points. Reply in ${language || 'English'}. Use ₹ for currency if mentioning money.
Ground everything ONLY in the data given below - do not invent statistics you were not given.

Shop: "${vendor.shop_name || 'this shop'}", category: "${vendor.shop_category || 'unknown'}".
Registered customers within 5km: ${customersNear}. Within 5-10km: ${customersFar}.
Competing shops in the same category within 10km: ${competitorCount}.
Shop categories already present nearby: ${present.join(', ') || 'none on record'}.
Shop categories with no shop found nearby: ${missing.join(', ') || 'none - most common categories are covered'}.
Local pricing context: ${pricing.income_source === 'unavailable' ? 'no local income data available' : `area classified as "${pricing.income_bracket}" income level (source: ${pricing.income_source})`}.`;

  try {
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Generate the report JSON now.' }],
      }),
    });
    const data = await response.json();
    const text = Array.isArray(data?.content) ? data.content.map((b) => b.text).filter(Boolean).join('\n') : '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.swot || !parsed.risks) return null;
    return { ...parsed, source: 'ai' };
  } catch (err) {
    console.error('Business report AI narrative error:', err.message);
    return null;
  }
}

function buildPricing(vendor, req) {
  const inputIncome = req.query.avg_local_income !== undefined ? parseFloat(req.query.avg_local_income) : null;

  let bracket = null;
  let source = 'unavailable';
  let swsPercent = null;

  if (inputIncome !== null && !Number.isNaN(inputIncome)) {
    source = 'input';
    // Illustrative monthly-household-income bands - adjust to local context.
    if (inputIncome < 15000) bracket = 'budget';
    else if (inputIncome < 40000) bracket = 'mid';
    else bracket = 'premium';
  } else {
    // Fall back to the vendor's own Ward Analysis, if they've run one, using
    // the target ward's socially-weaker-section % as an inverse income proxy.
    const targetWard = db.prepare('SELECT * FROM wards WHERE user_id = ? AND is_target = 1').get(req.userId);
    if (targetWard && targetWard.sws_percent !== null && targetWard.sws_percent !== undefined) {
      source = 'ward_analysis';
      swsPercent = targetWard.sws_percent;
      if (swsPercent >= 30) bracket = 'budget';
      else if (swsPercent >= 12) bracket = 'mid';
      else bracket = 'premium';
    }
  }

  const MARGIN_BANDS = {
    budget: [12, 20],
    mid: [20, 30],
    premium: [30, 45],
  };

  let sampleProducts = [];
  if (bracket) {
    const [lowPct, highPct] = MARGIN_BANDS[bracket];
    const products = db.prepare('SELECT name, cost_price, selling_price FROM products WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5').all(req.userId);
    sampleProducts = products.map((p) => ({
      name: p.name,
      cost_price: p.cost_price,
      current_price: p.selling_price,
      suggested_price_range: [
        Math.round(p.cost_price * (1 + lowPct / 100) * 100) / 100,
        Math.round(p.cost_price * (1 + highPct / 100) * 100) / 100,
      ],
    }));
  }

  return {
    income_source: source, // 'input' | 'ward_analysis' | 'unavailable'
    income_bracket: bracket, // 'budget' | 'mid' | 'premium' | null
    suggested_margin_pct: bracket ? MARGIN_BANDS[bracket] : null,
    sample_products: sampleProducts,
    note: source === 'unavailable'
      ? 'Pass ?avg_local_income=<monthly rupees> or complete a Ward Analysis for this ward to get a pricing suggestion.'
      : undefined,
  };
}

// GET /business-report?near_km=5&far_km=10&avg_local_income=18000
router.get('/', async (req, res) => {
  const vendor = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'vendor'").get(req.userId);
  if (!vendor) return res.status(400).json({ error: 'Only vendor accounts can generate a business report' });
  if (vendor.latitude === null || vendor.longitude === null) {
    return res.status(400).json({ error: 'Set your shop location (latitude/longitude) in your profile first' });
  }

  const nearKm = req.query.near_km !== undefined ? parseFloat(req.query.near_km) : 5;
  const farKm = req.query.far_km !== undefined ? parseFloat(req.query.far_km) : 10;

  // --- Nearby customers ---
  const customers = db.prepare("SELECT latitude, longitude FROM users WHERE role = 'customer'").all();
  let customersNear = 0;
  let customersFar = 0;
  for (const c of customers) {
    const d = distanceKm(vendor.latitude, vendor.longitude, c.latitude, c.longitude);
    if (d === null) continue;
    if (d <= nearKm) customersNear += 1;
    else if (d <= farKm) customersFar += 1;
  }

  // --- Competitor mapping ---
  const vendors = db.prepare("SELECT id, shop_name, shop_category, latitude, longitude FROM users WHERE role = 'vendor' AND id != ?").all(req.userId);
  const myCategory = classifyCategory(vendor.shop_category);
  const competitors = [];
  const presentCategoriesSet = new Set();
  for (const v of vendors) {
    const d = distanceKm(vendor.latitude, vendor.longitude, v.latitude, v.longitude);
    if (d === null || d > farKm) continue;
    const cat = classifyCategory(v.shop_category);
    if (cat) presentCategoriesSet.add(cat);
    if (myCategory && cat === myCategory) {
      competitors.push({ shop_name: v.shop_name, distance_km: Number(d.toFixed(2)) });
    }
  }
  competitors.sort((a, b) => a.distance_km - b.distance_km);
  if (myCategory) presentCategoriesSet.add(myCategory); // this shop itself counts as "present"

  const present = CANONICAL_CATEGORIES.filter((c) => presentCategoriesSet.has(c));
  const missing = CANONICAL_CATEGORIES.filter((c) => !presentCategoriesSet.has(c));

  const pricing = buildPricing(vendor, req);

  const aiResult = await aiNarrative({
    vendor, customersNear, customersFar, competitorCount: competitors.length, missing, present, pricing,
    language: req.query.language,
  });
  const narrative = aiResult || ruleBasedNarrative({
    vendor, customersNear, customersFar, competitorCount: competitors.length, missing, pricing,
  });

  res.json({
    generated_at: new Date().toISOString(),
    vendor: { shop_name: vendor.shop_name, shop_category: vendor.shop_category, latitude: vendor.latitude, longitude: vendor.longitude },
    radius_km: { near: nearKm, far: farKm },
    customers_nearby: { within_near_radius: customersNear, near_to_far_radius: customersFar, total: customersNear + customersFar },
    competitors: { category: myCategory, count: competitors.length, nearest: competitors.slice(0, 10) },
    categories: { present, missing },
    pricing,
    narrative,
  });
});

module.exports = router;
