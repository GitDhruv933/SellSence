import { useState } from 'react';
import { ShoppingBag, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/api/client';

export default function AuthScreen() {
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(phone, password);
      } else {
        await signup({ phone, password, name, role: 'customer' });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-soft mx-auto mb-3">
            <ShoppingBag className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="font-display font-extrabold text-2xl text-gray-900">SellSence</h1>
          <p className="text-sm text-gray-400 font-medium">Shop from local vendors near you</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
              />
            )}
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              required
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min. 6 characters)"
              required
              minLength={6}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
            />

            {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-soft transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-4">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="font-semibold text-primary-700"
            >
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>

          <p className="text-center text-[11px] text-gray-400 mt-3">
            Own a shop?{' '}
            <a href={import.meta.env.VITE_VENDOR_APP_URL || '#'} className="font-semibold text-accent-600">
              Go to the vendor site
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
