import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: LucideIcon;
  color: 'primary' | 'accent' | 'warning' | 'success';
}

const colorMap = {
  primary: { bg: 'bg-primary-50', text: 'text-primary-600', ring: 'ring-primary-100' },
  accent: { bg: 'bg-accent-50', text: 'text-accent-600', ring: 'ring-accent-100' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
  success: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
};

export default function StatCard({ label, value, change, positive, icon: Icon, color }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-soft hover:shadow-card transition-all duration-300 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.text} flex items-center justify-center ring-4 ${c.ring}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div
          className={`flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-full ${
            positive ? 'bg-primary-50 text-primary-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {change}
        </div>
      </div>
      <p className="font-display font-extrabold text-2xl text-gray-900 leading-none mb-1">
        {value}
      </p>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
    </div>
  );
}
