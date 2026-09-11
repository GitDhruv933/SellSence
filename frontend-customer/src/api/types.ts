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
  avg_rating?: number;
  review_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
  customer_name: string;
}

export interface ProductReviewSummary {
  reviews: Review[];
  count: number;
  average: number;
}

export interface ReviewableItem {
  order_item_id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  vendor_id: number;
  shop_name: string;
  delivered_at: string;
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

export interface MonthlyPoint {
  month: string;
  sales: number;
  predicted: number;
}
