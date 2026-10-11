import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

// Sun/moon toggle for the top-right corner of the app. Persists to
// localStorage and defaults to the OS preference on first visit
// (see ThemeContext).
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
    >
      {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
    </button>
  );
}
