import { useState } from 'react';
import type { DailyPoint } from '@/api/types';

interface DailySalesChartProps {
  data: DailyPoint[];
}

export default function DailySalesChart({ data }: DailySalesChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxVal = Math.max(1, ...data.map(d => Math.max(d.revenue, d.profit)));

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
        <h3 className="font-display font-bold text-base text-gray-900 mb-1">Daily Sales (7d)</h3>
        <p className="text-xs text-gray-400 font-medium mb-4">Revenue vs profit per day</p>
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-gray-400">No sales data for the last 7 days.</p>
        </div>
      </div>
    );
  }

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalProfit = data.reduce((s, d) => s + d.profit, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display font-bold text-base text-gray-900">Daily Sales (7d)</h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Revenue vs profit per day</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-primary-500" />
            <span className="text-gray-500 font-medium">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-accent-400" />
            <span className="text-gray-500 font-medium">Profit</span>
          </div>
        </div>
      </div>

      <div className="relative h-48">
        <div className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="border-t border-gray-50" />
          ))}
        </div>

        <div className="relative h-full flex items-end justify-between gap-1.5 sm:gap-2">
          {data.map((point, idx) => {
            const revHeight = (point.revenue / maxVal) * 100;
            const profitHeight = (Math.max(0, point.profit) / maxVal) * 100;
            const isHovered = hovered === idx;
            return (
              <div
                key={point.fullDate}
                className="relative flex-1 h-full flex items-end justify-center cursor-pointer group"
                onMouseEnter={() => setHovered(idx)}
                onMouseLeave={() => setHovered(null)}
              >
                {isHovered && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-10 bg-gray-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-float animate-scale-in">
                    <div className="text-primary-300">Rev: ₹{point.revenue.toLocaleString()}</div>
                    <div className="text-accent-300">Profit: ₹{point.profit.toLocaleString()}</div>
                    <div className="text-gray-400 text-[10px] mt-0.5">{point.fullDate}</div>
                  </div>
                )}
                <div className="relative w-full max-w-[28px] h-full flex items-end justify-center gap-0.5">
                  <div
                    className="flex-1 bg-gradient-to-t from-primary-600 to-primary-400 rounded-t-md transition-all duration-500 group-hover:from-primary-700 group-hover:to-primary-500"
                    style={{ height: `${Math.max(revHeight, 2)}%` }}
                  />
                  <div
                    className="flex-1 bg-gradient-to-t from-accent-500/40 to-accent-400/70 rounded-t-md transition-all duration-500"
                    style={{ height: `${Math.max(profitHeight, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between mt-2">
          {data.map(point => (
            <span key={point.fullDate} className="text-[10px] text-gray-400 font-medium flex-1 text-center">
              {point.day}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-gray-50">
        <div>
          <p className="text-[11px] text-gray-400 font-medium">7-Day Revenue</p>
          <p className="font-display font-bold text-sm text-gray-900">₹{totalRevenue.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400 font-medium">7-Day Profit</p>
          <p className={`font-display font-bold text-sm ${totalProfit >= 0 ? 'text-primary-600' : 'text-red-500'}`}>
            ₹{totalProfit.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
