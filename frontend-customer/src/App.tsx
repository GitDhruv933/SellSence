import { useState } from 'react';
import { LogOut, Store } from 'lucide-react';
import type { Product, CartItem } from '@/types';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import CustomerView from '@/components/CustomerView';
import CartDrawer from '@/components/CartDrawer';
import AuthScreen from '@/components/AuthScreen';
import MyOrders from '@/components/MyOrders';

function ShoppingApp() {
  const [cartOpen, setCartOpen] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const currentVendor = prev[0]?.product.vendorId;
      if (currentVendor && currentVendor !== product.vendorId) {
        const proceed = window.confirm(
          'Your cart has items from another shop. Starting a new order will clear it. Continue?'
        );
        if (!proceed) return prev;
        return [{ product, quantity: 1 }];
      }
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const handleIncrement = (id: string) => {
    setCart((prev) =>
      prev.map((item) => (item.product.id === id ? { ...item, quantity: item.quantity + 1 } : item))
    );
  };

  const handleDecrement = (id: string) => {
    setCart((prev) =>
      prev
        .map((item) => (item.product.id === id ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemove = (id: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== id));
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        cartCount={cartCount}
        onCartClick={() => setCartOpen(true)}
        onOrdersClick={() => setShowOrders(true)}
      />
      <main>
        {showOrders ? (
          <MyOrders onBack={() => setShowOrders(false)} />
        ) : (
          <CustomerView onAddToCart={handleAddToCart} />
        )}
      </main>
      <CartDrawer
        open={cartOpen}
        items={cart}
        onClose={() => setCartOpen(false)}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
        onRemove={handleRemove}
        onOrderPlaced={() => setCart([])}
      />
    </div>
  );
}

// This site is customer-only. If a vendor account logs in here (e.g. by
// mistake, since both roles share the same backend), turn them away instead
// of showing a broken customer experience.
function WrongRoleScreen() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-soft mx-auto mb-4">
          <Store className="w-7 h-7 text-white" />
        </div>
        <h2 className="font-display font-bold text-lg text-gray-900 mb-1">This is the customer site</h2>
        <p className="text-sm text-gray-500 mb-5">
          Your account is registered as a vendor. Please use the vendor site to manage your shop.
        </p>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gray-900 text-white text-sm font-semibold"
        >
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
    </div>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-gray-50" />;
  if (!user) return <AuthScreen />;
  if (user.role !== 'customer') return <WrongRoleScreen />;
  return <ShoppingApp />;
}

function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

export default App;
