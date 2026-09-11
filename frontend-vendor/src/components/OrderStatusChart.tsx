import type { OrderStatusMap } from '@/api/types';

interface OrderStatusChartProps {
  data: OrderStatusMap;
}

const STATUS_META = [
  { key: 'pending', label: 'Pending', color: '#ef4444' },
  { key: 'confirmed', label: 'Confirmed', color: '#f59e0b' },
  { key: 'preparing', label: 'Preparing', color: '#3b82f6' },
  { key: 'out_for_delivery', label: 'Out for delivery', color: '#8b5cf6' },
  { key: 'delivered', label: 'Delivered', color: '#10b981' },
  { key: 'cancelled', label: 'Cancelled', color: '#9ca3af' },
] as const;

export default function OrderStatusChart({ data }: OrderStatusChartProps) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  const active = data.pending + data.confirmed + data.preparing + data.out_for_delivery;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-base text-gray-900">Order Status</h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5">{active} active · {total} total</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {STATUS_META.map(({ key, label, color }) => {
          const count = data[key];
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={key} className="p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
              </div>
              <p className="font-display font-bold text-lg text-gray-900 leading-none">{count}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-0.5">{pct.toFixed(0)}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
