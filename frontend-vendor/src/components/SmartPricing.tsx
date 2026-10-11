import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Loader2, AlertTriangle, History, Check, X } from 'lucide-react';
import { ApiError, pricingApi } from '@/api/client';
import type { PricingSuggestion, PriceChangeLogEntry } from '@/api/types';

// Module 4: Smart Pricing.
//
// Turns two signals the app already has - product views vs sales, and
// quality-praise sentiment from reviews - into a price suggestion the
// vendor can accept or dismiss. Nothing here ever changes a price on its
// own: /pricing/suggestions only returns recommendations with their
// reasoning, and a price only moves when the vendor taps "Apply" (logged
// server-side either way).

function ReasonBadge({ s }: { s: PricingSuggestion }) {
  const isUp = s.direction === 'increase';
  return (
    <span
      className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
        isUp
          ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300'
          : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
      }`}
    >
      {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {isUp ? '+' : '-'}
      {s.pct}%
    </span>
  );
}

export default function SmartPricing() {
  const [enabled, setEnabled] = useState(true);
  const [suggestions, setSuggestions] = useState<PricingSuggestion[]>([]);
  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [history, setHistory] = useState<PriceChangeLogEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pricingApi.suggestions();
      setSuggestions(data.suggestions);
      setWindowDays(data.windowDays);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load pricing suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enabled) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const loadHistory = async () => {
    try {
      const data = await pricingApi.history();
      setHistory(data.history);
    } catch {
      // Non-critical - history is a secondary view.
    }
  };

  const toggleHistory = () => {
    setShowHistory((prev) => {
      if (!prev) loadHistory();
      return !prev;
    });
  };

  const applySuggestion = async (s: PricingSuggestion) => {
    setApplyingId(s.product.id);
    try {
      await pricingApi.apply(s.product.id, s.suggestedPrice, s.reason);
      setSuggestions((prev) => prev.filter((x) => x.product.id !== s.product.id));
      if (showHistory) loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not apply that price change');
    } finally {
      setApplyingId(null);
    }
  };

  const dismiss = (productId: number) => {
    setDismissedIds((prev) => new Set(prev).add(productId));
  };

  const visibleSuggestions = suggestions.filter((s) => !dismissedIds.has(s.product.id));

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-soft p-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Smart Pricing</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Suggestions only - a price never changes until you tap Apply. Based on the last {windowDays} days of
            views and sales, plus quality mentions in your reviews.
          </p>
        </div>
        <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{enabled ? 'On' : 'Off'}</span>
          <button
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`w-10 h-6 rounded-full transition-colors relative ${
              enabled ? 'bg-accent-500' : 'bg-gray-200 dark:bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-4' : ''
              }`}
            />
          </button>
        </label>
      </div>

      {!enabled && (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-soft p-4">
          Smart Pricing is off - flip the switch above to see suggestions.
        </p>
      )}

      {enabled && error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm rounded-lg p-3">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {enabled && loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-soft p-4">
          <Loader2 size={16} className="animate-spin" /> Checking your products...
        </div>
      )}

      {enabled && !loading && visibleSuggestions.length === 0 && !error && (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-soft p-4">
          No pricing suggestions right now - nothing has crossed a threshold yet.
        </p>
      )}

      {enabled &&
        visibleSuggestions.map((s) => (
          <div
            key={s.product.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-soft p-4"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">{s.product.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{s.product.category}</p>
              </div>
              <ReasonBadge s={s} />
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{s.reason}</p>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-gray-400 dark:text-gray-500 line-through">₹{s.currentPrice}</span>
              <span className="text-lg font-bold text-gray-800 dark:text-gray-100">₹{s.suggestedPrice}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => applySuggestion(s)}
                disabled={applyingId === s.product.id}
                className="flex items-center gap-1.5 rounded-lg bg-accent-500 text-white px-3 py-1.5 text-sm font-medium hover:bg-accent-600 disabled:opacity-60"
              >
                {applyingId === s.product.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Apply
              </button>
              <button
                onClick={() => dismiss(s.product.id)}
                className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                <X size={14} />
                Dismiss
              </button>
            </div>
          </div>
        ))}

      <button
        onClick={toggleHistory}
        className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        <History size={15} />
        {showHistory ? 'Hide price change history' : 'Show price change history'}
      </button>

      {showHistory && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-soft p-4">
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">No price changes applied yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="text-sm border-b border-gray-50 dark:border-gray-700 last:border-0 pb-2 last:pb-0">
                  <span className="font-medium text-gray-700 dark:text-gray-200">{h.product_name}</span>{' '}
                  <span className="text-gray-400 dark:text-gray-500">
                    ₹{h.old_price} → ₹{h.new_price}
                  </span>
                  {h.reason && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{h.reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
