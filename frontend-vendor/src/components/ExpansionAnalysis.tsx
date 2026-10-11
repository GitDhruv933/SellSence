// ExpansionAnalysis.tsx — new "EXPANSION OPPORTUNITIES" section for WardAnalysis.
// Data comes from WARD_CATALOG (preset, seeded) — the vendor only picks their ward.
// Render this BELOW the existing classification results inside WardAnalysis.tsx.

import { useMemo, useState } from 'react';
import { Trophy, Map as MapIcon, Loader2, ArrowRight } from 'lucide-react';
import { WARD_CATALOG, scoreWard } from "../data/wardCatalog";

const TIER_COLORS = { high: '#22c55e', medium: '#f59e0b', low: '#ef4444' } as const;
const TIER_LABEL = { high: 'High', medium: 'Medium', low: 'Low' } as const;

// Vendor shop location — in production pull from the auth context / users table
// (your backend already stores latitude/longitude per vendor on signup).
const VENDOR_LOC: [number, number] = [77.5946, 12.9716]; // Bengaluru fallback

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-700"
             style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-bold text-gray-700 dark:text-gray-200">{value}</span>
    </div>
  );
}

export default function ExpansionAnalysis({ wards }: { wards: { name: string; category?: string | null }[] }) {
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);

  // Score every catalog ward, excluding the vendor's own target ward if it matches by name.
  const ranked = useMemo(() => {
    const targetName = wards.find(w => w.is_target)?.name;
    return WARD_CATALOG
      .filter(w => w.name !== targetName)
      .map(w => scoreWard(w, WARD_CATALOG, VENDOR_LOC))
      .sort((a, b) => b.score - a.score);
  }, [wards]);

  const best = ranked[0];
  const estRevenue = (w: PresetWard) => (w.population_density * 0.32).toFixed(1); // ₹ L / month, tuned demo model

  const run = () => { setRunning(true); setTimeout(() => { setRan(true); setRunning(false); }, 900); };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-bold text-lg text-gray-900 dark:text-gray-100">Expansion Opportunities</h3>
        <p className="text-sm text-gray-400 dark:text-gray-500">Find the best areas to grow your business based on demand, competition and profitability.</p>
      </div>

      {/* 🏆 BEST OPPORTUNITY */}
      {ran && best && (
        <div className="bg-gradient-to-br from-emerald-50 to-white dark:to-gray-800 border border-emerald-100 dark:border-emerald-800 rounded-2xl p-5 shadow-soft max-w-md">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Best opportunity</span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="font-display font-extrabold text-xl text-gray-900 dark:text-gray-100">{best.name}</span>
            <span className="font-display font-extrabold text-xl text-emerald-600 dark:text-emerald-400">{best.score} / 100 ⭐</span>
          </div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mb-4">High Expansion Potential</p>
          <dl className="space-y-1.5 text-sm mb-4">
            <div className="flex justify-between"><dt className="text-gray-400 dark:text-gray-500">Est. Revenue</dt><dd className="font-semibold text-gray-800 dark:text-gray-100">₹{estRevenue(best)}L / month</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400 dark:text-gray-500">Competition</dt><dd className="font-semibold text-gray-800 dark:text-gray-100">{TIER_LABEL[best.competition_index > 60 ? 'high' : best.competition_index > 35 ? 'medium' : 'low']}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400 dark:text-gray-500">Customer Demand</dt><dd className="font-semibold text-gray-800 dark:text-gray-100">{best.demand >= 70 ? 'High' : best.demand >= 45 ? 'Medium' : 'Low'}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-400 dark:text-gray-500">Distance</dt><dd className="font-semibold text-gray-800 dark:text-gray-100">{best.distance_km} km</dd></div>
          </dl>
          <button className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
            View Opportunity <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 🗺 MARKET OPPORTUNITY MAP — plug your Leaflet satellite map here and
          color polygons by `tier` instead of PCA category. Legend below it. */}
      {ran && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5">
          <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
            <MapIcon className="w-4 h-4" /> Market Opportunity Map
          </h4>
          {/* <WardMap wards={ranked.map(w => ({...w, category: w.tier}))} />  ← reuse existing WardMap with tier colors,
              or swap in the Leaflet + Esri satellite WardMap from the earlier fix for the Google-Earth view. */}
          <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: TIER_COLORS.high }} /> High</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: TIER_COLORS.medium }} /> Medium</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: TIER_COLORS.low }} /> Low</span>
          </div>
        </div>
      )}

      {/* 📊 TOP EXPANSION AREAS */}
      {ran && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Ward</th>
                <th className="px-4 py-2.5 text-left font-semibold">Score</th>
                <th className="px-4 py-2.5 text-left font-semibold">Demand</th>
                <th className="px-4 py-2.5 text-left font-semibold">Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {ranked.slice(0, 6).map(w => (
                <tr key={w.name}>
                  <td className="px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-100">{w.name}</td>
                  <td className="px-4 py-2.5 font-bold" style={{ color: TIER_COLORS[w.tier] }}>{w.score}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{w.demand >= 70 ? 'High' : w.demand >= 45 ? 'Medium' : 'Low'}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-bold" style={{ color: TIER_COLORS[w.tier] }}>
                      {w.tier === 'high' ? '🟢' : w.tier === 'medium' ? '🟡' : '🔴'} {w.verdict}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* WHY THESE AREAS? */}
      {ran && best && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5 space-y-3">
          <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Why {best.name}?</h4>
          <Bar label="Demand" value={best.demand} />
          <Bar label="Competition" value={100 - best.competition_index} />
          <Bar label="Spending" value={best.spending} />
          <Bar label="Accessibility" value={best.accessibility} />
        </div>
      )}

      <button
        onClick={run}
        disabled={running}
        className="px-5 py-2.5 rounded-xl bg-accent-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
      >
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapIcon className="w-4 h-4" />}
        {ran ? 'Re-run Expansion Analysis' : 'Run Expansion Analysis'}
      </button>
    </div>
  );
}
