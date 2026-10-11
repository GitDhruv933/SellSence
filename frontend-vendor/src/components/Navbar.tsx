import type { LucideIcon } from 'lucide-react';
import { Store, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ThemeToggle from './ThemeToggle';

export interface NavTab {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface NavbarProps {
  tabs: NavTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

// A fixed, left-aligned vertical sidebar: brand at top, the section nav in
// the middle (scrolls independently if the list ever outgrows the screen),
// and the signed-in vendor + theme toggle + logout pinned at the bottom.
// Collapses to an icon-only rail below the `lg` breakpoint so it stays out
// of the way on smaller screens without needing a hamburger/drawer.
export default function Navbar({ tabs, activeTab, onTabChange }: NavbarProps) {
  const { user, logout } = useAuth();

  const initials = (user?.shop_name || user?.name || '?')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-16 lg:w-64 flex flex-col bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2.5 h-16 px-3 lg:px-5 border-b border-gray-100 dark:border-gray-700 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-soft shrink-0">
          <Store className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <div className="hidden lg:block min-w-0">
          <h1 className="font-display font-extrabold text-base leading-none text-gray-900 dark:text-gray-100 truncate">
            SellSence
          </h1>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium leading-none mt-1">Shop management</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2 lg:px-3 space-y-1">
        {tabs.map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            title={label}
            className={`relative w-full flex items-center gap-3 px-2.5 lg:px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === key
                ? 'bg-accent-500 text-white shadow-soft'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900'
            }`}
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            <span className="hidden lg:inline truncate">{label}</span>
            {!!badge && (
              <span className="absolute top-1.5 right-1.5 lg:static lg:ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="border-t border-gray-100 dark:border-gray-700 p-2 lg:p-3 shrink-0 space-y-2">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {initials}
          </div>
          <div className="hidden lg:block min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-none truncate">{user?.shop_name}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-none mt-1 truncate">{user?.phone}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-center lg:justify-start">
          <ThemeToggle />
          <button
            onClick={logout}
            title="Log out"
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center transition-colors group shrink-0"
          >
            <LogOut className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-red-500" />
          </button>
        </div>
      </div>
    </aside>
  );
}
