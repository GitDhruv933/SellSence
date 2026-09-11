import { Store, ShoppingBag, LogOut, Receipt } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface NavbarProps {
  cartCount: number;
  onCartClick: () => void;
  onOrdersClick: () => void;
}

export default function Navbar({ cartCount, onCartClick, onOrdersClick }: NavbarProps) {
  const { user, logout } = useAuth();

  const initials = (user?.name || '?')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-soft">
              <Store className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-display font-extrabold text-lg leading-none text-gray-900">SellSence</h1>
              <p className="text-[11px] text-gray-400 font-medium leading-none mt-0.5">
                Hyper-local marketplace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onOrdersClick}
              title="My Orders"
              className="w-10 h-10 rounded-full bg-gray-100 hover:bg-primary-50 flex items-center justify-center transition-colors group"
            >
              <Receipt className="w-5 h-5 text-gray-600 group-hover:text-primary-700 transition-colors" />
            </button>
            <button
              onClick={onCartClick}
              className="relative w-10 h-10 rounded-full bg-gray-100 hover:bg-primary-50 flex items-center justify-center transition-colors group"
            >
              <ShoppingBag className="w-5 h-5 text-gray-600 group-hover:text-primary-700 transition-colors" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-accent-500 text-white text-[11px] font-bold flex items-center justify-center animate-scale-in">
                  {cartCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-white font-bold text-sm">
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-gray-800 leading-none">{user?.name}</p>
                <p className="text-[11px] text-gray-400 leading-none mt-0.5">{user?.phone}</p>
              </div>
            </div>

            <button
              onClick={logout}
              title="Log out"
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-red-50 flex items-center justify-center transition-colors group"
            >
              <LogOut className="w-4 h-4 text-gray-500 group-hover:text-red-500" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
