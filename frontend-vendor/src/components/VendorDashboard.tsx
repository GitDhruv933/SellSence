import {
  TrendingUp,
  Package,
  AlertTriangle,
  Receipt,
  Sparkles,
  Bell,
  Loader2,
  Phone,
  Truck,
  CheckCircle2,
  Map,
  FileText,
  Calculator,
  Swords,
  IndianRupee,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/api/client';
import Navbar from './Navbar';
import type {
  BackendProduct,
  Order,
  OrderStatus,
  RestockSuggestion,
  AnalyticsSummary,
  MonthlyPoint,
  TodaySummary,
  WeeklyComparison,
  DailyPoint,
  CategoryBreakdownItem,
  ProfitMarginItem,
  StockTrendPoint,
  OrderStatusMap,
} from '@/api/types';
import StatCard from './StatCard';
import InventoryTable, { type ProductFormValues } from './InventoryTable';
import AIAssistant from './AIAssistant';
import SalesChart from './SalesChart';
import DailySalesChart from './DailySalesChart';
import StockTrendChart from './StockTrendChart';
import CategoryBreakdown from './CategoryBreakdown';
import ProfitMarginChart from './ProfitMarginChart';
import OrderStatusChart from './OrderStatusChart';
import WardAnalysis from './WardAnalysis';
import BusinessReport from './BusinessReport';
import FinancialCalculator from './FinancialCalculator';
import WordAnalysis from './WordAnalysis';
import SmartPricing from './SmartPricing';

type Tab = 'overview' | 'inventory' | 'orders' | 'insights' | 'wards' | 'report' | 'finance' | 'words' | 'pricing';

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function VendorDashboard() {
  const [tab, setTab] = useState<Tab>('overview');

  const [products, setProducts] = useState<BackendProduct[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [today, setToday] = useState<TodaySummary | null>(null);
  const [weekly, setWeekly] = useState<WeeklyComparison | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyPoint[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [byProduct, setByProduct] = useState<{ name: string; units_sold: number; revenue: number; profit: number }[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdownItem[]>([]);
  const [profitMargins, setProfitMargins] = useState<ProfitMarginItem[]>([]);
  const [stockTrend, setStockTrend] = useState<StockTrendPoint[]>([]);
  const [orderStatus, setOrderStatus] = useState<OrderStatusMap | null>(null);
  const [suggestions, setSuggestions] = useState<RestockSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingId, setBillingId] = useState<number | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [
        p,
        o,
        t,
        w,
        s,
        m,
        d,
        bp,
        cat,
        pm,
        st,
        os,
        rs,
      ] = await Promise.all([
        api.get<BackendProduct[]>('/products'),
        api.get<Order[]>('/orders/incoming'),
        api.get<TodaySummary>('/analytics/today'),
        api.get<WeeklyComparison>('/analytics/weekly-comparison'),
        api.get<AnalyticsSummary>('/analytics/summary?days=30'),
        api.get<MonthlyPoint[]>('/analytics/monthly?months=6'),
        api.get<DailyPoint[]>('/analytics/daily?days=7'),
        api.get<{ name: string; units_sold: number; revenue: number; profit: number }[]>('/analytics/by-product?days=30'),
        api.get<CategoryBreakdownItem[]>('/analytics/category-breakdown?days=30'),
        api.get<ProfitMarginItem[]>('/analytics/profit-margin?days=30'),
        api.get<StockTrendPoint[]>('/analytics/stock-trend?days=30'),
        api.get<OrderStatusMap>('/analytics/order-status'),
        api.get<RestockSuggestion[]>('/analytics/restock-suggestions?days=30'),
      ]);
      setProducts(p);
      setOrders(o);
      setToday(t);
      setWeekly(w);
      setSummary(s);
      setMonthly(m);
      setDaily(d);
      setByProduct(bp);
      setCategories(cat);
      setProfitMargins(pm);
      setStockTrend(st);
      setOrderStatus(os);
      setSuggestions(rs);
    } catch {
      // silent fail — keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 8000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const pendingOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const highAlertCount = orders.filter(o => o.status === 'pending').length;
  const lowStockCount = suggestions.filter(s => s.action === 'buy_more').length;
  const pendingBills = orders.filter(o => !o.bill_generated_at && o.status !== 'cancelled').length;

  const handleAddProduct = async (values: ProductFormValues) => {
    const created = await api.post<BackendProduct>('/products', values);
    setProducts(prev => [created, ...prev]);
  };

  const handleUpdateProduct = async (id: number, values: Partial<ProductFormValues>) => {
    const updated = await api.put<BackendProduct>(`/products/${id}`, values);
    setProducts(prev => prev.map(p => (p.id === id ? updated : p)));
  };

  const handleDeleteProduct = async (id: number) => {
    await api.del(`/products/${id}`);
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const advanceStatus = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    const updated = await api.put<Order>(`/orders/${order.id}/status`, { status: next });
    setOrders(prev => prev.map(o => (o.id === order.id ? updated : o)));
  };

  const generateBill = async (order: Order) => {
    setBillingId(order.id);
    try {
      const updated = await api.put<Order>(`/orders/${order.id}/bill`, {});
      setOrders(prev => prev.map(o => (o.id === order.id ? updated : o)));
      loadAll();
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert('Could not generate the bill — check your connection and try again.');
      }
    } finally {
      setBillingId(null);
    }
  };

  const maxByProductRevenue = Math.max(1, ...byProduct.map(p => p.revenue));

  const tabs = [
    { key: 'overview', label: 'Overview', icon: TrendingUp, badge: 0 },
    { key: 'inventory', label: 'Inventory', icon: Package, badge: 0 },
    { key: 'orders', label: 'Orders', icon: Bell, badge: highAlertCount },
    { key: 'insights', label: 'Sales Insights', icon: Sparkles, badge: 0 },
    { key: 'wards', label: 'Ward Analysis', icon: Map, badge: 0 },
    { key: 'report', label: 'Business Report', icon: FileText, badge: 0 },
    { key: 'finance', label: 'Financial Calculator', icon: Calculator, badge: 0 },
    { key: 'words', label: 'Word Analysis', icon: Swords, badge: 0 },
    { key: 'pricing', label: 'Smart Pricing', icon: IndianRupee, badge: 0 },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar tabs={[...tabs]} activeTab={tab} onTabChange={(key) => setTab(key as Tab)} />

      <div className="pl-16 lg:pl-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-display font-extrabold text-2xl text-gray-900 dark:text-gray-100 mb-1">Vendor Dashboard</h2>
              <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Manage your shop, orders, and business insights</p>
            </div>
            {loading && <Loader2 className="w-5 h-5 text-gray-300 dark:text-gray-600 animate-spin" />}
          </div>

          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Today's Sales"
                  value={`₹${(today?.revenue ?? 0).toLocaleString()}`}
                  change={today?.status === 'profit' ? 'Profit' : today ? 'Loss' : '—'}
                  positive={today ? today.profit_or_loss >= 0 : true}
                  icon={TrendingUp}
                  color="primary"
                />
                <StatCard
                  label="Active Orders"
                  value={String(pendingOrders.length)}
                  change={weekly ? `${weekly.revenue_change_pct >= 0 ? '+' : ''}${weekly.revenue_change_pct}% vs last week` : `${highAlertCount} new`}
                  positive={weekly ? weekly.revenue_change_pct >= 0 : true}
                  icon={Package}
                  color="accent"
                />
                <StatCard
                  label="Low Stock Alerts"
                  value={String(lowStockCount)}
                  change={lowStockCount > 0 ? 'Needs restock' : 'All good'}
                  positive={lowStockCount === 0}
                  icon={AlertTriangle}
                  color="warning"
                />
                <StatCard
                  label="Bills Pending"
                  value={String(pendingBills)}
                  change="Generate now"
                  positive={pendingBills === 0}
                  icon={Receipt}
                  color="success"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SalesChart data={monthly} />
                <DailySalesChart data={daily} />
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5">
                <h3 className="font-display font-bold text-base text-gray-900 dark:text-gray-100 mb-4">Top-Moving Products (30d)</h3>
                {byProduct.filter(p => p.units_sold > 0).length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">No sales recorded yet in the last 30 days.</p>
                ) : (
                  <div className="space-y-3">
                    {byProduct
                      .filter(p => p.units_sold > 0)
                      .slice(0, 5)
                      .map((tp, idx) => (
                        <div key={tp.name} className="flex items-center gap-3">
                          <span className="w-6 text-center text-sm font-bold text-gray-400 dark:text-gray-500">{idx + 1}</span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{tp.name}</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                                {tp.units_sold} units · ₹{tp.revenue.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-700"
                                style={{ width: `${(tp.revenue / maxByProductRevenue) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {orderStatus && <OrderStatusChart data={orderStatus} />}
                <StockTrendChart data={stockTrend} />
              </div>
            </div>

            <div className="lg:col-span-1">
              <AIAssistant suggestions={suggestions} />
            </div>
          </div>
        )}

        {tab === 'inventory' && (
          <div className="animate-fade-in">
            <InventoryTable
              products={products}
              onAdd={handleAddProduct}
              onUpdate={handleUpdateProduct}
              onDelete={handleDeleteProduct}
            />
          </div>
        )}

        {tab === 'orders' && (
          <div className="animate-fade-in space-y-3">
            {orders.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                <Bell className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">No orders yet. New orders will alert you here.</p>
              </div>
            ) : (
              orders.map(order => {
                const isHighAlert = order.status === 'pending';
                return (
                  <div
                    key={order.id}
                    className={`bg-white dark:bg-gray-800 rounded-2xl border p-4 shadow-soft ${
                      isHighAlert ? 'border-red-200 dark:border-red-800 ring-2 ring-red-100' : 'border-gray-100 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-display font-bold text-sm text-gray-900 dark:text-gray-100">Order #{order.id}</h4>
                          {isHighAlert && (
                            <span className="flex items-center gap-1 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                              <Bell className="w-2.5 h-2.5" /> HIGH ALERT
                            </span>
                          )}
                          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                            {STATUS_LABEL[order.status]}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          {order.customer_name || 'Customer'}
                          {order.customer_phone && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-500" />
                              <Phone className="w-3 h-3" /> {order.customer_phone}
                            </>
                          )}
                        </p>
                      </div>
                      <span className="font-display font-extrabold text-base text-gray-900 dark:text-gray-100">₹{order.total.toFixed(2)}</span>
                    </div>

                    <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-0.5 mb-3">
                      {order.items.map(i => (
                        <li key={i.id} className="flex justify-between">
                          <span>{i.product_name} × {i.quantity}</span>
                          <span>₹{(i.unit_price * i.quantity).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center gap-2 flex-wrap">
                      {NEXT_STATUS[order.status] && (
                        <button
                          onClick={() => advanceStatus(order)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-semibold"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          Mark {STATUS_LABEL[NEXT_STATUS[order.status]!]}
                        </button>
                      )}
                      {!order.bill_generated_at ? (
                        <button
                          onClick={() => generateBill(order)}
                          disabled={billingId === order.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-xs font-semibold disabled:opacity-60"
                        >
                          {billingId === order.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Receipt className="w-3.5 h-3.5" />
                          )}
                          Generate Bill
                        </button>
                      ) : (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Billed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'insights' && (
          <div className="space-y-6 animate-fade-in">
            <SalesChart data={monthly} expanded />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <CategoryBreakdown data={categories} />
              <ProfitMarginChart data={profitMargins} />
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5">
                <h3 className="font-display font-bold text-base text-gray-900 dark:text-gray-100 mb-4">Restock Suggestions</h3>
                <div className="space-y-3">
                  {suggestions.filter(s => s.action !== 'maintain').length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">Nothing needs attention right now.</p>
                  ) : (
                    suggestions
                      .filter(s => s.action !== 'maintain')
                      .map(s => (
                        <div
                          key={s.product_id}
                          className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{s.name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{s.reason}</p>
                          </div>
                          <span
                            className={`text-xs font-bold px-2 py-1 rounded-full ${
                              s.action === 'buy_more' ? 'bg-primary-50 text-primary-700' : 'bg-accent-50 text-accent-700'
                            }`}
                          >
                            {s.action === 'buy_more' ? 'Buy more' : 'Buy less'}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5">
              <h3 className="font-display font-bold text-base text-gray-900 dark:text-gray-100 mb-4">Revenue by Product (30d)</h3>
              <div className="space-y-3">
                {byProduct.filter(p => p.revenue > 0).length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">No revenue recorded yet.</p>
                ) : (
                  byProduct
                    .filter(p => p.revenue > 0)
                    .slice(0, 6)
                    .map(c => {
                      const totalRevenue = byProduct.reduce((sum, p) => sum + p.revenue, 0) || 1;
                      const pct = Math.round((c.revenue / totalRevenue) * 100);
                      return (
                        <div key={c.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{c.name}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{pct}%</span>
                          </div>
                          <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'wards' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5">
            <WardAnalysis />
          </div>
        )}

        {tab === 'report' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5">
            <BusinessReport />
          </div>
        )}

        {tab === 'finance' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5">
            <FinancialCalculator />
          </div>
        )}

        {tab === 'words' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5">
            <WordAnalysis />
          </div>
        )}

        {tab === 'pricing' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5">
            <SmartPricing />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
