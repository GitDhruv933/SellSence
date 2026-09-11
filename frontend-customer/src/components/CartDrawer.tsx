import { X, ShoppingBag, Plus, Minus, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import type { CartItem } from '@/types';
import type { Order } from '@/api/types';
import { api, ApiError } from '@/api/client';

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onOrderPlaced: () => void;
}

export default function CartDrawer({
  open,
  items,
  onClose,
  onIncrement,
  onDecrement,
  onRemove,
  onOrderPlaced,
}: CartDrawerProps) {
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const deliveryFee = subtotal > 0 ? 25 : 0;
  const total = subtotal + deliveryFee;

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setError('');
    setPlacing(true);
    try {
      const vendorId = Number(items[0].product.vendorId);
      const order = await api.post<Order>('/orders', {
        vendor_id: vendorId,
        items: items.map((i) => ({ product_id: Number(i.product.id), quantity: i.quantity })),
      });
      setPlacedOrder(order);
      onOrderPlaced();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const handleClose = () => {
    setPlacedOrder(null);
    setError('');
    onClose();
  };

  if (placedOrder) {
    return (
      <>
        <div
          className={`fixed inset-0 bg-black/30 z-50 transition-opacity duration-300 ${
            open ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={handleClose}
        />
        <div
          className={`fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-50 shadow-float flex flex-col items-center justify-center px-8 text-center transition-transform duration-300 ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <CheckCircle2 className="w-14 h-14 text-primary-600 mb-4" />
          <h3 className="font-display font-bold text-lg text-gray-900 mb-1">Order placed!</h3>
          <p className="text-sm text-gray-500 mb-1">
            Order #{placedOrder.id} · Total ₹{placedOrder.total.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mb-6">
            The shop has been notified and will confirm your order shortly.
          </p>
          <button
            onClick={handleClose}
            className="px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-soft"
          >
            Done
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-50 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-50 shadow-float flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary-600" />
            <h3 className="font-display font-bold text-base text-gray-900">Your Cart</h3>
            <span className="text-sm text-gray-400 font-medium">({items.length})</span>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium text-sm">Your cart is empty</p>
              <p className="text-gray-400 text-xs mt-1">Add items from nearby shops to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex gap-3 bg-gray-50 rounded-xl p-3 animate-fade-in"
                >
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-gray-900 truncate">
                      {item.product.name}
                    </h4>
                    <p className="text-xs text-gray-400 mb-2">{item.product.vendorName}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 bg-white rounded-full border border-gray-200 p-0.5">
                        <button
                          onClick={() => onDecrement(item.product.id)}
                          className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3 h-3 text-gray-600" />
                        </button>
                        <span className="text-sm font-bold text-gray-800 w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onIncrement(item.product.id)}
                          className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3 h-3 text-gray-600" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-sm text-gray-900">
                          ₹{item.product.price * item.quantity}
                        </span>
                        <button
                          onClick={() => onRemove(item.product.id)}
                          className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors group"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold text-gray-800">₹{subtotal}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Delivery fee</span>
                <span className="font-semibold text-gray-800">₹{deliveryFee}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="font-display font-bold text-base text-gray-900">Total</span>
              <span className="font-display font-extrabold text-xl text-gray-900">₹{total}</span>
            </div>
            {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
            <button
              onClick={handleCheckout}
              disabled={placing}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-soft hover:shadow-card transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {placing && <Loader2 className="w-4 h-4 animate-spin" />}
              Checkout • {items.length} {items.length === 1 ? 'item' : 'items'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
