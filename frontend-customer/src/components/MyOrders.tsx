import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Loader2, Package, Star, CheckCircle2 } from 'lucide-react';
import type { Order } from '@/api/types';
import { orderApi, reviewApi, ApiError } from '@/api/client';

interface MyOrdersProps {
  onBack: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function ReviewForm({
  orderId,
  productId,
  onDone,
}: {
  orderId: number;
  productId: number;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await reviewApi.submit({ order_id: orderId, product_id: productId, rating, comment });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit review');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-xl">
      <div className="flex items-center gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)}>
            <Star
              className={`w-5 h-5 ${n <= rating ? 'fill-accent-400 text-accent-400' : 'text-gray-300'}`}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share a few words about this item (optional)"
        rows={2}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-primary-200 resize-none"
      />
      {error && <p className="text-xs font-semibold text-red-600 mt-1">{error}</p>}
      <button
        onClick={submit}
        disabled={saving}
        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold disabled:opacity-60"
      >
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Submit review
      </button>
    </div>
  );
}

export default function MyOrders({ onBack }: MyOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsReview, setNeedsReview] = useState<Set<string>>(new Set());
  const [openReview, setOpenReview] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([orderApi.mine(), reviewApi.reviewable()])
      .then(([orders, reviewable]) => {
        setOrders(orders);
        setNeedsReview(new Set(reviewable.map((r) => `${r.order_id}-${r.product_id}`)));
      })
      .catch(() => {
        setOrders([]);
        setNeedsReview(new Set());
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [orders]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-primary-700 mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to shops
        </button>

        <h2 className="font-display font-extrabold text-2xl text-gray-900 mb-4">My Orders</h2>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Package className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">You haven't placed any orders yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display font-bold text-sm text-gray-900">Order #{order.id}</h3>
                  <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {STATUS_LABEL[order.status] || order.status}
                  </span>
                </div>
                <ul className="space-y-2">
                  {order.items.map((item) => {
                    const key = `${order.id}-${item.product_id}`;
                    const canReview = order.status === 'delivered' && needsReview.has(key);
                    return (
                      <li key={item.id} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-700">
                            {item.product_name} × {item.quantity}
                          </span>
                          <span className="text-gray-500">₹{(item.unit_price * item.quantity).toFixed(2)}</span>
                        </div>
                        {order.status === 'delivered' && (
                          canReview ? (
                            openReview === key ? (
                              <ReviewForm
                                orderId={order.id}
                                productId={item.product_id}
                                onDone={() => {
                                  setOpenReview(null);
                                  load();
                                }}
                              />
                            ) : (
                              <button
                                onClick={() => setOpenReview(key)}
                                className="mt-1 text-xs font-semibold text-primary-700 hover:text-primary-800"
                              >
                                Write a review
                              </button>
                            )
                          ) : (
                            <span className="mt-1 flex items-center gap-1 text-xs text-primary-600 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Reviewed
                            </span>
                          )
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-400">
                    {new Date(order.created_at).toLocaleDateString()}
                  </span>
                  <span className="font-display font-bold text-sm text-gray-900">
                    ₹{order.total.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
