// Shapes returned by the vendor-inventory-backend API.

export type Role = 'customer' | 'vendor';

export interface AuthUser {
  id: number;
  phone: string;
  name: string;
  role: Role;
  shop_name: string;
  shop_category: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  language: string;
}

export interface Shop {
  id: number;
  name: string;
  shop_name: string;
  shop_category: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  item_count: number;
  distance_km: number | null;
}

export interface BackendProduct {
  id: number;
  user_id: number;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  quantity: number;
  reorder_level: number;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';

export interface Order {
  id: number;
  customer_id: number;
  vendor_id: number;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total: number;
  delivery_address: string;
  bill_generated_at: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  customer_name?: string;
  customer_phone?: string;
}

export interface AppNotification {
  id: number;
  user_id: number;
  order_id: number | null;
  type: string;
  priority: 'normal' | 'high';
  message: string;
  read: number;
  created_at: string;
}

export interface RestockSuggestion {
  product_id: number;
  name: string;
  category: string;
  quantity: number;
  units_sold_period: number;
  daily_velocity: number;
  days_of_stock_left: number | null;
  capital_tied_up: number;
  action: 'buy_more' | 'buy_less' | 'maintain';
  reason: string;
}

export interface AnalyticsSummary {
  period_days: number;
  revenue: number;
  cost_of_goods: number;
  profit_or_loss: number;
  status: 'profit' | 'loss';
  units_sold: number;
}

export interface TodaySummary {
  revenue: number;
  cost_of_goods: number;
  profit_or_loss: number;
  status: 'profit' | 'loss';
  units_sold: number;
  transactions: number;
}

export interface WeeklyComparison {
  this_week: { revenue: number; transactions: number; orders: number };
  last_week: { revenue: number; transactions: number; orders: number };
  revenue_change_pct: number;
  order_change_pct: number;
}

export interface MonthlyPoint {
  month: string;
  sales: number;
  predicted: number;
}

export interface DailyPoint {
  day: string;
  fullDate: string;
  revenue: number;
  cost: number;
  profit: number;
}

export interface CategoryBreakdownItem {
  category: string;
  revenue: number;
  units: number;
  pct: number;
}

export interface ProfitMarginItem {
  id: number;
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: number;
}

export interface StockTrendPoint {
  date: string;
  stock: number;
}

export interface OrderStatusMap {
  pending: number;
  confirmed: number;
  preparing: number;
  out_for_delivery: number;
  delivered: number;
  cancelled: number;
}

export interface AIChartData {
  type: 'pie' | 'bar' | 'line';
  title: string;
  data: Record<string, unknown>[];
}

export interface AIChatResponse {
  reply: string;
  chart?: AIChartData | null;
  source?: string;
}

// --- Ward market-expansion analysis (Steps 1-7) ---

// Minimal GeoJSON geometry shape (avoids a dependency on @types/geojson) —
// covers what ee.Geometry.getInfo() in scripts/gee_ward_boundary.py emits.
export interface WardGeometry {
  type: 'Polygon' | 'MultiPolygon' | string;
  coordinates: unknown;
}

export interface Ward {
  id: number;
  name: string;
  is_target: boolean;
  population_density: number | null;
  household_density: number | null;
  sws_percent: number | null;
  area_sq_km: number | null;
  population_worldpop: number | null;
  built_up_density_ghsl: number | null;
  boundary_geojson: WardGeometry | null;
  pca_score: number | null;
  category: string | null;
  updated_at: string;
}

export interface WardDiagnostics {
  kmo: number;
  kmo_adequacy: string;
  bartlett_chi_square: number;
  bartlett_df: number;
  bartlett_p_value: number | null;
  bartlett_significant: boolean | null;
  n_wards: number;
  n_indicators: number;
}

export interface WardPcaSummary {
  components_kept: number;
  explained_variance_ratio: number[];
  total_variance_explained_pct: number;
  loadings: Record<string, number[]>;
}

export interface WardClassifyResponse {
  diagnostics: WardDiagnostics;
  warnings: string[];
  pca: WardPcaSummary;
  classification: { mean_score: number; sd_score: number };
  wards: Ward[];
}

// --- Module 1: Local Business Report ---

export interface CompetitorNearby {
  shop_name: string | null;
  distance_km: number;
}

export interface BusinessReportPricingProduct {
  name: string;
  cost_price: number;
  current_price: number;
  suggested_price_range: [number, number];
}

export interface BusinessReportPricing {
  income_source: 'input' | 'ward_analysis' | 'unavailable';
  income_bracket: 'budget' | 'mid' | 'premium' | null;
  suggested_margin_pct: [number, number] | null;
  sample_products: BusinessReportPricingProduct[];
  note?: string;
}

export interface BusinessSwot {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface BusinessNarrative {
  swot: BusinessSwot;
  risks: string[];
  pricing_note: string;
  source: 'ai' | 'rule-based';
}

export interface BusinessReport {
  generated_at: string;
  vendor: { shop_name: string | null; shop_category: string | null; latitude: number; longitude: number };
  radius_km: { near: number; far: number };
  customers_nearby: { within_near_radius: number; near_to_far_radius: number; total: number };
  competitors: { category: string | null; count: number; nearest: CompetitorNearby[] };
  categories: { present: string[]; missing: string[] };
  pricing: BusinessReportPricing;
  narrative: BusinessNarrative;
}

// --- Module 2: Smart Financial Calculator ---

export interface RepaymentScheduleRow {
  month: number;
  phase: 'moratorium' | 'regular';
  opening_balance: number;
  payment: number;
  interest: number;
  principal_paid: number;
  closing_balance: number;
}

export interface FinancialEstimate {
  inputs: { own_contribution: number; own_contribution_pct: number };
  total_project_cost: number;
  loan_amount: number;
  scheme: { name: 'Micro Finance' | 'Term Loan'; reason: string };
  interest_rate_pct: number;
  tenure_months: number;
  moratorium_months: number;
  emi_after_moratorium: number;
  total_interest_payable: number;
  total_repayment: number;
  repayment_schedule: RepaymentScheduleRow[];
  working_capital: {
    source: 'input' | 'purchases_history_90d_avg' | 'fallback_estimate';
    monthly_operating_expenses: number;
    cycle_months: number;
    working_capital_needed: number;
  };
  disclaimer: string;
}

// --- Module 3: Smart Competitor Word Analysis ---

export interface WordAnalysisPhrase {
  phrase: string;
  count: number;
  example: string;
}

export interface WordAnalysisWord {
  word: string;
  count: number;
  example: string;
}

export interface WordAnalysisResult {
  reviewsAnalyzed: number;
  topPhrases: WordAnalysisPhrase[];
  topWords: WordAnalysisWord[];
  message?: string;
}

export interface OwnWordAnalysis extends WordAnalysisResult {
  ratingMax: number;
  totalReviews: number;
  avgRating: number;
}

export interface RivalVendor {
  id: number;
  shop_name: string | null;
  shop_category: string | null;
  review_count: number;
  negative_review_count: number;
}

export interface RivalsResponse {
  category?: string;
  rivals: RivalVendor[];
  message?: string;
}

export interface CompetitorWordAnalysis extends WordAnalysisResult {
  vendor: { id: number; shop_name: string | null; shop_category: string | null };
  ratingMax: number;
  totalReviews: number;
  avgRating: number;
}

export interface ExternalWordAnalysis extends WordAnalysisResult {
  sourceLabel: string;
}

// --- Module 4: Smart Pricing ---

export interface PricingSuggestion {
  product: { id: number; name: string; category: string | null; unit: string };
  currentPrice: number;
  suggestedPrice: number;
  direction: 'increase' | 'decrease';
  pct: number;
  reason: string;
  metric: Record<string, number | null>;
  otherSignalsConsidered: boolean;
}

export interface PricingSuggestionsResponse {
  windowDays: number;
  suggestions: PricingSuggestion[];
}

export interface PricingApplyResponse {
  product: { id: number; name: string; selling_price: number };
  oldPrice: number;
  newPrice: number;
}

export interface PriceChangeLogEntry {
  id: number;
  product_id: number;
  product_name: string;
  old_price: number;
  new_price: number;
  reason: string | null;
  source: string;
  created_at: string;
}

export interface PricingHistoryResponse {
  history: PriceChangeLogEntry[];
}
