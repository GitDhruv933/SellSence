import { useState } from 'react';
import { Users, Store, TrendingUp, AlertTriangle, IndianRupee, Loader2, RefreshCw } from 'lucide-react';
import { ApiError, businessReportApi } from '@/api/client';
import type { BusinessReport as BusinessReportData } from '@/api/types';

// Module 1: Local Business Report.
// Nearby-customer count, competitor mapping, and category-gap analysis are
// computed straight from this vendor's own app data (customers, other
// vendors, distances). The SWOT / local-risks / pricing narrative on top of
// those numbers is written by Claude when ANTHROPIC_API_KEY is configured on
// the backend, or by a rule-based template otherwise - either way it's the
// same computed numbers underneath, just narrated differently.

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-soft p-4">
      <h3 className="flex items-center gap-2 font-semibold text-gray-800 mb-3">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function BulletList({ items, tone }: { items: string[]; tone: 'green' | 'red' | 'blue' | 'amber' }) {
  const toneClasses: Record<string, string> = {
    green: 'text-green-700 before:text-green-500',
    red: 'text-red-700 before:text-red-500',
    blue: 'text-blue-700 before:text-blue-500',
    amber: 'text-amber-700 before:text-amber-500',
  };
  if (items.length === 0) return <p className="text-sm text-gray-400 italic">Nothing notable found.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className={`text-sm pl-4 relative before:content-['•'] before:absolute before:left-0 ${toneClasses[tone]}`}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function BusinessReport() {
  const [report, setReport] = useState<BusinessReportData | null>(null);
  const [avgIncome, setAvgIncome] = useState('');
  const [nearKm, setNearKm] = useState('5');
  const [farKm, setFarKm] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { near_km?: number; far_km?: number; avg_local_income?: number } = {};
      if (nearKm.trim() !== '') params.near_km = Number(nearKm);
      if (farKm.trim() !== '') params.far_km = Number(farKm);
      if (avgIncome.trim() !== '') params.avg_local_income = Number(avgIncome);
      const data = await businessReportApi.generate(params);
      setReport(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate the report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-soft p-4">
        <h2 className="font-semibold text-gray-800 mb-1">Local Business Report</h2>
        <p className="text-xs text-gray-500 mb-4">
          Uses your shop's registered location against other customers and vendors already in the app - the
          more customers and vendors are registered nearby, the more useful this report gets.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Near radius (km)</label>
            <input
              type="number"
              value={nearKm}
              onChange={(e) => setNearKm(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Far radius (km)</label>
            <input
              type="number"
              value={farKm}
              onChange={(e) => setFarKm(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-gray-500 mb-1">Avg. local monthly income (₹, optional)</label>
            <input
              type="number"
              value={avgIncome}
              onChange={(e) => setAvgIncome(e.target.value)}
              placeholder="e.g. 18000"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-accent-500 text-white px-3 py-1.5 text-sm font-medium hover:bg-accent-600 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {report ? 'Regenerate' : 'Generate report'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Leaving the income field blank falls back to your Ward Analysis (if you've run one) for a pricing
          suggestion; otherwise pricing is skipped.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm rounded-lg p-3">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {report && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-soft p-3 text-center">
              <div className="text-2xl font-bold text-gray-800">{report.customers_nearby.within_near_radius}</div>
              <div className="text-xs text-gray-500">customers within {report.radius_km.near}km</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-soft p-3 text-center">
              <div className="text-2xl font-bold text-gray-800">{report.customers_nearby.near_to_far_radius}</div>
              <div className="text-xs text-gray-500">{report.radius_km.near}-{report.radius_km.far}km</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-soft p-3 text-center">
              <div className="text-2xl font-bold text-gray-800">{report.competitors.count}</div>
              <div className="text-xs text-gray-500">same-category shops nearby</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-soft p-3 text-center">
              <div className="text-2xl font-bold text-gray-800">{report.categories.missing.length}</div>
              <div className="text-xs text-gray-500">category gaps found</div>
            </div>
          </div>

          <Section title="Competitor mapping" icon={<Store size={16} />}>
            {report.competitors.nearest.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No other shops in the same category found nearby.</p>
            ) : (
              <ul className="space-y-1">
                {report.competitors.nearest.map((c, i) => (
                  <li key={i} className="flex justify-between text-sm text-gray-700">
                    <span>{c.shop_name || 'Unnamed shop'}</span>
                    <span className="text-gray-400">{c.distance_km} km</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Missing business opportunities" icon={<Users size={16} />}>
            {report.categories.missing.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Most common categories are already represented nearby.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {report.categories.missing.map((c) => (
                  <span key={c} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">{c}</span>
                ))}
              </div>
            )}
          </Section>

          <Section title="SWOT analysis" icon={<TrendingUp size={16} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Strengths</p>
                <BulletList items={report.narrative.swot.strengths} tone="green" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Weaknesses</p>
                <BulletList items={report.narrative.swot.weaknesses} tone="red" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Opportunities</p>
                <BulletList items={report.narrative.swot.opportunities} tone="blue" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Threats</p>
                <BulletList items={report.narrative.swot.threats} tone="amber" />
              </div>
            </div>
          </Section>

          <Section title="Local risks" icon={<AlertTriangle size={16} />}>
            <BulletList items={report.narrative.risks} tone="amber" />
          </Section>

          <Section title="Suggested pricing" icon={<IndianRupee size={16} />}>
            {report.pricing.income_source === 'unavailable' ? (
              <p className="text-sm text-gray-500">{report.pricing.note}</p>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-2">
                  {report.pricing.income_bracket && (
                    <>
                      Area classified as <span className="font-medium">{report.pricing.income_bracket}</span> income
                      level (source: {report.pricing.income_source === 'ward_analysis' ? 'your ward analysis' : 'income you entered'}).
                      Suggested margin: {report.pricing.suggested_margin_pct?.[0]}%–{report.pricing.suggested_margin_pct?.[1]}%.
                    </>
                  )}
                </p>
                {report.pricing.sample_products.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400">
                        <th className="py-1">Product</th>
                        <th className="py-1">Cost</th>
                        <th className="py-1">Current</th>
                        <th className="py-1">Suggested</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.pricing.sample_products.map((p, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          <td className="py-1.5">{p.name}</td>
                          <td className="py-1.5">₹{p.cost_price}</td>
                          <td className="py-1.5">₹{p.current_price}</td>
                          <td className="py-1.5 font-medium text-accent-600">
                            ₹{p.suggested_price_range[0]}–₹{p.suggested_price_range[1]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="text-xs text-gray-400 mt-2">{report.narrative.pricing_note}</p>
              </>
            )}
          </Section>

          <p className="text-xs text-gray-400 text-center">
            Generated {new Date(report.generated_at).toLocaleString()} · narrative source: {report.narrative.source}
          </p>
        </>
      )}
    </div>
  );
}
