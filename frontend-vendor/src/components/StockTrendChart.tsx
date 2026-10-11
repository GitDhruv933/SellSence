import { useState } from 'react';
import type { StockTrendPoint } from '@/api/types';

interface StockTrendChartProps {
  data: StockTrendPoint[];
}

export default function StockTrendChart({ data }: StockTrendChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5">
        <h3 className="font-display font-bold text-base text-gray-900 dark:text-gray-100 mb-1">Stock Level Trend</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-4">Total inventory units over time</p>
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">No stock trend data available.</p>
        </div>
      </div>
    );
  }

  const maxStock = Math.max(...data.map(d => d.stock), 1);
  const minStock = Math.min(...data.map(d => d.stock));
  const current = data[data.length - 1]?.stock ?? 0;
  const start = data[0]?.stock ?? 0;
  const change = current - start;

  // Build SVG polyline points
  const width = 100;
  const height = 100;
  const padding = 5;
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - ((d.stock / maxStock) * (height - padding * 2));
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `${padding},${height} ${points} ${width - padding},${height}`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display font-bold text-base text-gray-900 dark:text-gray-100">Stock Level Trend</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mt-0.5">Total inventory units over time</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-3 h-3 rounded-full bg-primary-500" />
          <span className="text-gray-500 dark:text-gray-400 font-medium">Stock</span>
        </div>
      </div>

      <div className="relative h-48">
        <div className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="border-t border-gray-50 dark:border-gray-700" />
          ))}
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="relative w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill="url(#stockGradient)" />
          <polyline
            points={points}
            fill="none"
            stroke="#10b981"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {data.map((d, i) => {
            const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
            const y = height - padding - ((d.stock / maxStock) * (height - padding * 2));
            const isHovered = hovered === i;
            return (
              <circle
                key={d.date}
                cx={x}
                cy={y}
                r={isHovered ? 2.5 : 1.5}
                fill={isHovered ? '#059669' : '#10b981'}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
        </svg>

        {hovered !== null && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-gray-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-float animate-scale-in">
            <div className="text-primary-300">{data[hovered].stock} units</div>
            <div className="text-gray-400 dark:text-gray-500 text-[10px]">{data[hovered].date}</div>
          </div>
        )}

        <div className="flex justify-between mt-2">
          {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((point, idx, arr) => {
            const prev = arr[idx - 1];
            const originalIndex = data.findIndex(d => d.date === point.date);
            const prevIndex = prev ? data.findIndex(d => d.date === prev.date) : -1;
            if (prevIndex !== -1 && originalIndex - prevIndex < 2 && idx > 0) return null;
            return (
              <span key={point.date} className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                {point.date.slice(5)}
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-50 dark:border-gray-700">
        <div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">Current Stock</p>
          <p className="font-display font-bold text-sm text-gray-900 dark:text-gray-100">{current.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">Lowest</p>
          <p className="font-display font-bold text-sm text-gray-900 dark:text-gray-100">{minStock.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">Change</p>
          <p className={`font-display font-bold text-sm ${change >= 0 ? 'text-primary-600' : 'text-red-500'}`}>
            {change >= 0 ? '+' : ''}{change.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
