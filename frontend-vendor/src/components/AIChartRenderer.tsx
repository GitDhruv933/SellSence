import type { AIChartData } from '@/api/types';

interface AIChartRendererProps {
  chart: AIChartData;
}

const COLORS = ['#10b981', '#f97316', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

function formatCurrency(n: number) {
  return '₹' + n.toLocaleString();
}

function PieChart({ data, title }: { data: Record<string, unknown>[]; title: string }) {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  let cumulative = 0;
  const size = 100;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <div className="mt-3">
      <p className="text-xs font-bold text-gray-500 mb-2">{title}</p>
      <div className="flex items-center gap-4">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-24 h-24 -rotate-90 flex-shrink-0">
          {data.map((d, i) => {
            const val = Number(d.value) || 0;
            const pct = total > 0 ? val / total : 0;
            const dash = pct * circumference;
            const offset = circumference - (cumulative / total) * circumference;
            cumulative += val;
            return (
              <circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </svg>
        <div className="flex-1 space-y-1">
          {data.map((d, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-gray-600 truncate max-w-[100px]">{String(d.name)}</span>
              </div>
              <span className="text-gray-400 font-semibold">{formatCurrency(Number(d.value) || 0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BarChart({ data, title }: { data: Record<string, unknown>[]; title: string }) {
  const maxVal = Math.max(1, ...data.map(d => Math.max(Number(d.revenue) || 0, Number(d.profit) || 0)));
  return (
    <div className="mt-3">
      <p className="text-xs font-bold text-gray-500 mb-2">{title}</p>
      <div className="space-y-2">
        {data.map((d, i) => {
          const rev = Number(d.revenue) || 0;
          const profit = Number(d.profit) || 0;
          return (
            <div key={i}>
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-gray-600 truncate max-w-[120px]">{String(d.name)}</span>
                <span className="text-gray-400">{formatCurrency(rev)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-primary-500 rounded-full" style={{ width: `${(rev / maxVal) * 100}%` }} />
              </div>
              {profit !== rev && (
                <div className="text-[10px] text-gray-400 mt-0.5">Profit: {formatCurrency(profit)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LineChart({ data, title }: { data: Record<string, unknown>[]; title: string }) {
  if (data.length === 0) return null;
  const values = data.map(d => Number(d.stock) || 0);
  const maxVal = Math.max(1, ...values);
  const width = 100;
  const height = 60;
  const padding = 5;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - ((Number(d.stock) || 0) / maxVal) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="mt-3">
      <p className="text-xs font-bold text-gray-500 mb-2">{title}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32" preserveAspectRatio="none">
        <defs>
          <linearGradient id="aiLineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`${padding},${height} ${points} ${width - padding},${height}`} fill="url(#aiLineGrad)" />
        <polyline points={points} fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{String(data[0]?.date).slice(5)}</span>
        <span>{String(data[data.length - 1]?.date).slice(5)}</span>
      </div>
    </div>
  );
}

export default function AIChartRenderer({ chart }: AIChartRendererProps) {
  if (!chart || !chart.data || chart.data.length === 0) return null;
  if (chart.type === 'pie') return <PieChart data={chart.data} title={chart.title} />;
  if (chart.type === 'bar') return <BarChart data={chart.data} title={chart.title} />;
  if (chart.type === 'line') return <LineChart data={chart.data} title={chart.title} />;
  return null;
}
