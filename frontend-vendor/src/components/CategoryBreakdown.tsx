import { useState } from 'react';
import type { CategoryBreakdownItem } from '@/api/types';

interface CategoryBreakdownProps {
  data: CategoryBreakdownItem[];
}

const COLORS = ['#10b981', '#f97316', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5">
        <h3 className="font-display font-bold text-base text-gray-900 dark:text-gray-100 mb-1">Revenue by Category</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-4">Last 30 days</p>
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">No category data yet.</p>
        </div>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.revenue, 0);
  let cumulativePct = 0;
  const size = 100;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-soft p-5">
      <div className="mb-4">
        <h3 className="font-display font-bold text-base text-gray-900 dark:text-gray-100">Revenue by Category</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mt-0.5">Last 30 days</p>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
            {data.map((item, i) => {
              const pct = item.pct / 100;
              const dash = pct * circumference;
              const offset = circumference - (cumulativePct / 100) * circumference;
              cumulativePct += item.pct;
              const isHovered = hovered === i;
              return (
                <circle
                  key={item.category}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={isHovered ? stroke + 2 : stroke}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={offset}
                  className="transition-all duration-300 cursor-pointer"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
            <text
              x={center}
              y={center}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-gray-900 text-[14px] font-bold"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              {hovered !== null ? `${data[hovered].pct}%` : '100%'}
            </text>
          </svg>
        </div>

        <div className="flex-1 space-y-2">
          {data.map((item, i) => (
            <div
              key={item.category}
              className="flex items-center justify-between text-xs"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-gray-600 dark:text-gray-300 font-medium truncate max-w-[100px]">{item.category}</span>
              </div>
              <span className="text-gray-400 dark:text-gray-500 font-semibold">₹{item.revenue.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
