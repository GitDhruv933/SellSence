import { Sparkles, Lightbulb, TrendingUp, TrendingDown, Send, Loader2, RotateCcw, BarChart3, PieChart, LineChart as LineChartIcon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { RestockSuggestion, AIChatResponse } from '@/api/types';
import { api, ApiError } from '@/api/client';
import AIChartRenderer from './AIChartRenderer';

interface AIAssistantProps {
  suggestions: RestockSuggestion[];
}

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  chart?: AIChatResponse['chart'] | null;
}

const actionConfig = {
  buy_more: { icon: TrendingUp, bg: 'bg-primary-50', text: 'text-primary-700', label: 'Buy more' },
  buy_less: { icon: TrendingDown, bg: 'bg-accent-50', text: 'text-accent-700', label: 'Buy less' },
  maintain: { icon: Lightbulb, bg: 'bg-blue-50', text: 'text-blue-700', label: 'On track' },
};

const SUGGESTED_PROMPTS = [
  { icon: BarChart3, text: 'Top sellers this week' },
  { icon: PieChart, text: 'Pie chart of my sales' },
  { icon: LineChartIcon, text: 'Stock trend this month' },
  { icon: TrendingUp, text: "What's my profit?" },
];

export default function AIAssistant({ suggestions }: AIAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const actionable = suggestions.filter(s => s.action !== 'maintain').slice(0, 5);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setSending(true);
    try {
      const res = await api.post<AIChatResponse>('/ai/chat', { message: msg });
      setMessages(prev => [...prev, { role: 'ai', text: res.reply, chart: res.chart }]);
    } catch (err) {
      const text = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      setMessages(prev => [...prev, { role: 'ai', text }]);
    } finally {
      setSending(false);
    }
  };

  const clearChat = () => setMessages([]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-soft flex flex-col h-full max-h-[800px]">
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-accent-50 rounded-t-2xl">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-soft">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-display font-bold text-sm text-gray-900 leading-none">Vendor AI Assistant</h3>
          <p className="text-[11px] text-gray-400 leading-none mt-1">Ask about sales, stock, or pricing</p>
        </div>
        <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-primary-600">
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
          Active
        </span>
      </div>

      <div ref={scrollRef} className="px-4 py-3 space-y-2.5 overflow-y-auto scrollbar-thin flex-1 min-h-0">
        {messages.length === 0 ? (
          <>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">
              Restock Suggestions
            </p>
            {actionable.length === 0 ? (
              <p className="text-xs text-gray-400 px-1">Stock levels look balanced right now.</p>
            ) : (
              actionable.map(s => {
                const cfg = actionConfig[s.action];
                const Icon = cfg.icon;
                return (
                  <div
                    key={s.product_id}
                    className="flex gap-2.5 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-default group"
                  >
                    <div className={`w-8 h-8 rounded-lg ${cfg.bg} ${cfg.text} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.text}`}>{cfg.label}</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-700 leading-snug">{s.name}</p>
                      <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{s.reason}</p>
                    </div>
                  </div>
                );
              })
            )}

            <div className="mt-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Quick Questions</p>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(p.text)}
                    className="flex items-center gap-1.5 p-2 rounded-xl bg-gray-50 hover:bg-primary-50 hover:text-primary-700 text-gray-600 text-[11px] font-semibold transition-colors text-left"
                  >
                    <p.icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{p.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] px-3.5 py-2.5 rounded-2xl text-xs font-medium leading-relaxed whitespace-pre-line animate-fade-in ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-700 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                  {msg.chart && <AIChartRenderer chart={msg.chart} />}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="px-3.5 py-2.5 rounded-2xl bg-gray-100 text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-100">
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="mb-2 flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 font-medium transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Back to suggestions
          </button>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask about sales, stock, pricing..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-medium outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all"
          />
          <button
            onClick={() => handleSend()}
            disabled={sending}
            className="w-10 h-10 rounded-xl bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center shadow-soft transition-all active:scale-90 flex-shrink-0 disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
