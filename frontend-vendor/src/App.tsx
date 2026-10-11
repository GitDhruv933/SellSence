import { LogOut, ShoppingBag } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import VendorDashboard from '@/components/VendorDashboard';
import AuthScreen from '@/components/AuthScreen';

// This site is vendor-only. If a customer account logs in here (both roles
// share the same backend), turn them away instead of showing an empty
// vendor dashboard.
function WrongRoleScreen() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-soft mx-auto mb-4">
          <ShoppingBag className="w-7 h-7 text-white" />
        </div>
        <h2 className="font-display font-bold text-lg text-gray-900 dark:text-gray-100 mb-1">This is the vendor site</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Your account is registered as a customer. Please use the customer site to shop.
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
  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900" />;
  if (!user) return <AuthScreen />;
  if (user.role !== 'vendor') return <WrongRoleScreen />;
  return <VendorDashboard />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
