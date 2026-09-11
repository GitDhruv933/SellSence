import { useState, useMemo } from 'react';
import type { MonthlyPoint } from '@/api/types';
 
interface SalesChartProps {
  data: MonthlyPoint[];
  expanded?: boolean;
}
 
function formatCompact(n: number): string {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'k';
  return '₹' + Math.round(n);
}
 
export default function SalesChart({ data = [], expanded = false }: SalesChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
 
  const maxVal = useMemo(() => {
    if (!data.length) return 1;
    const max = Math.max(...data.map(d => Math.max(d.sales || 0, d.predicted || 0)));
    return max > 0 ? max : 1;
  }, [data]);
 
  const { yoyText, yoyPositive } = useMemo(() => {
    if (data.length < 2) return { yoyText: '—', yoyPositive: true };
    const first = data.find(d => d.sales > 0);
    const last = [...data].reverse().find(d => d.sales > 0);
    if (!first || !last || first === last) return { yoyText: '—', yoyPositive: true };
    const change = ((last.sales - first.sales) / Math.max(first.sales, 1)) * 100;
    return { yoyText: `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`, yoyPositive: change >= 0 };
  }, [data]);
 
  const totalRevenue = data.reduce((s, d) => s + (d.sales || 0), 0);
  const avgMonthly = data.length > 0 ? totalRevenue / data.length : 0;
 
  if (data.length === 0) {
    return (
      <div className={`bg-white rounded-2xl border border-gray-100 shadow-soft p-5 ${expanded ? 'h-96' : ''}`}>
        <h3 className="font-display font-bold text-base text-gray-900">Sales Performance</h3>
        <p className="text-xs text-gray-400 font-medium mt-0.5">Actual vs AI-predicted revenue</p>
        <div className="h-48 flex items-center justify-center mt-4">
          <p className="text-sm text-gray-400">No monthly data available.</p>
        </div>
      </div>
    );
  }
 
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display font-bold text-base text-gray-900">Sales Performance</h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Actual vs AI-predicted revenue</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-primary-500" />
            <span className="text-gray-500 font-medium">Actual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-accent-400 border-dashed" />
            <span className="text-gray-500 font-medium">Predicted</span>
          </div>
        </div>
      </div>
 
      {/* Chart Canvas Area */}
      <div className={`relative ${expanded ? 'h-64' : 'h-44'}`}>
        {/* Background Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="border-t border-gray-100 w-full" />
          ))}
        </div>
 
        {/* Bars Container */}
        <div className="relative h-full flex items-end justify-between gap-1.5 sm:gap-2 px-2">
          {data.map((point, idx) => {
            const salesHeight = ((point.sales || 0) / maxVal) * 100;
            const predictedHeight = ((point.predicted || 0) / maxVal) * 100;
            const isHovered = hovered === idx;
 
            return (
              <div
                key={point.month || idx}
                className="relative flex-1 h-full flex items-end justify-center cursor-pointer group"
                onMouseEnter={() => setHovered(idx)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-20 bg-gray-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-float animate-scale-in">
                    <div className="text-primary-300">Actual: {formatCompact(point.sales || 0)}</div>
                    <div className="text-accent-300">Predicted: {formatCompact(point.predicted || 0)}</div>
                  </div>
                )}
 
                {/* Individual Bar Pairs */}
                <div className="relative w-full max-w-[28px] h-full flex items-end justify-center gap-0.5">
                  <div
                    className="flex-1 bg-gradient-to-t from-primary-600 to-primary-400 rounded-t-md transition-all duration-300 group-hover:from-primary-700 group-hover:to-primary-500"
                    style={{ height: `${Math.max(salesHeight, 2)}%` }}
                  />
                  <div
                    className="flex-1 bg-gradient-to-t from-accent-500/30 to-accent-400/60 rounded-t-md border border-dashed border-accent-400 transition-all duration-300"
                    style={{ height: `${Math.max(predictedHeight, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
 
      {/* Month Labels (Placed Outside Chart Canvas) */}
      <div className="flex justify-between mt-3 px-2">
        {data.map((point, idx) => (
          <span key={point.month || idx} className="text-[11px] text-gray-400 font-medium flex-1 text-center truncate">
            {point.month}
          </span>
        ))}
      </div>
 
      {/* Summary Stats Footer */}
      <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-100">
        <div>
          <p className="text-[11px] text-gray-400 font-medium">Total Revenue</p>
          <p className="font-display font-bold text-sm text-gray-900">{formatCompact(totalRevenue)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400 font-medium">Avg Monthly</p>
          <p className="font-display font-bold text-sm text-gray-900">{formatCompact(avgMonthly)}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400 font-medium">Growth Trend</p>
          <p className={`font-display font-bold text-sm ${yoyPositive ? 'text-primary-600' : 'text-red-500'}`}>
            {yoyText}
          </p>
        </div>
      </div>
    </div>
  );
}