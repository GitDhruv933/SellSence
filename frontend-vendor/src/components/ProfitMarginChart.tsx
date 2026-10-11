import { useState } from 'react';
import type { ProfitMarginItem } from '@/api/types';

interface ProfitMarginChartProps {
  data: ProfitMarginItem[];
}

export default function ProfitMarginChart({ data }: ProfitMarginChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const filtered = data.filter(d => d.revenue > 0).slice(0, 6);
  const maxMargin = Math.max(1, ...filtered.map(d => d.margin_pct));

  if (filtered.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5">
        <h3 className="font-display font-bold text-base text-gray-900 dark:text-gray-100 mb-1">Profit Margins</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-4">By product (last 30 days)</p>
        <div className="h-40 flex items-center justify-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">No profit data yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5">
      <h3 className="font-display font-bold text-base text-gray-900 dark:text-gray-100 mb-1">Profit Margins</h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-4">By product (last 30 days)</p>
      <div className="space-y-3">
        {filtered.map((item, idx) => {
          const isHovered = hovered === idx;
          const widthPct = (item.margin_pct / maxMargin) * 100;
          return (
            <div key={item.id} className="group cursor-default"
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[140px]">{item.name}</span>
                <span className={`text-xs font-bold ${item.margin_pct < 0 ? 'text-red-500' : 'text-primary-600'}`}>
                  {item.margin_pct}%
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${item.margin_pct < 0 ? 'bg-red-400' : 'bg-gradient-to-r from-primary-400 to-primary-600'}`}
                  style={{ width: `${Math.max(widthPct, 2)}%` }}
                />
              </div>
              {isHovered && (
                <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                  Rev ₹{item.revenue.toLocaleString()} · Cost ₹{item.cost.toLocaleString()} · Profit ₹{item.profit.toLocaleString()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
