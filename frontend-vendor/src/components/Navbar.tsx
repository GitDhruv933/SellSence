import { Store, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  const initials = (user?.shop_name || user?.name || '?')
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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-soft">
              <Store className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-display font-extrabold text-lg leading-none text-gray-900">
                SellSence for Vendors
              </h1>
              <p className="text-[11px] text-gray-400 font-medium leading-none mt-0.5">Shop management</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-white font-bold text-sm">
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-gray-800 leading-none">{user?.shop_name}</p>
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
