import { useEffect, useState } from 'react';
import { MessageSquareText, Swords, ClipboardPaste, Loader2, RefreshCw, AlertTriangle, Quote } from 'lucide-react';
import { ApiError, wordAnalysisApi } from '@/api/client';
import type { OwnWordAnalysis, RivalVendor, CompetitorWordAnalysis, ExternalWordAnalysis, WordAnalysisResult } from '@/api/types';

// Module 3: Smart Competitor Word Analysis.
//
// Normal word analysis only looks at YOUR reviews. This tab adds a second
// lens: point the same complaint-mining engine at a rival's reviews instead
// - either a rival already on SellSence (in the same shop category), or a
// rival anywhere else on the web via a pasted review dump. Either way it
// surfaces the phrases customers repeat when they complain, e.g. "battery
// life" or "zipper broke", so a vendor knows what to avoid or fix before
// competing for that same customer.

type LensTab = 'own' | 'rival' | 'external';

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-soft p-3 text-center">
      <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

function PhraseResults({ data, emptyHint }: { data: WordAnalysisResult | null; emptyHint: string }) {
  if (!data) return null;

  if (data.reviewsAnalyzed === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 italic bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-soft p-4">
        {data.message || emptyHint}
      </p>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-soft p-4">
      <h3 className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100 mb-1">
        <MessageSquareText size={16} />
        What customers complain about
      </h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Based on {data.reviewsAnalyzed} negative review comment(s).</p>

      {data.topPhrases.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic mb-3">
          No repeated complaint phrases yet - each reviewer said something different.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {data.topPhrases.map((p) => (
            <span
              key={p.phrase}
              title={p.example}
              className="text-sm bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3 py-1.5 rounded-full font-medium"
            >
              "{p.phrase}" <span className="text-red-400 font-normal">×{p.count}</span>
            </span>
          ))}
        </div>
      )}

      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Top complaint words</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {data.topWords.map((w) => (
          <span key={w.word} title={w.example} className="text-xs bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
            {w.word} ×{w.count}
          </span>
        ))}
      </div>

      {data.topPhrases[0] && (
        <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 border-t border-gray-50 dark:border-gray-700 pt-3">
          <Quote size={14} className="mt-0.5 shrink-0 text-gray-300 dark:text-gray-600" />
          <span className="italic">"{data.topPhrases[0].example}"</span>
        </div>
      )}
    </div>
  );
}

export default function WordAnalysis() {
  const [lens, setLens] = useState<LensTab>('own');

  // Own reviews
  const [own, setOwn] = useState<OwnWordAnalysis | null>(null);
  const [ownLoading, setOwnLoading] = useState(false);
  const [ownError, setOwnError] = useState<string | null>(null);

  const loadOwn = async () => {
    setOwnLoading(true);
    setOwnError(null);
    try {
      setOwn(await wordAnalysisApi.own());
    } catch (err) {
      setOwnError(err instanceof ApiError ? err.message : 'Could not load your review analysis');
    } finally {
      setOwnLoading(false);
    }
  };

  useEffect(() => {
    loadOwn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rival vendors
  const [rivals, setRivals] = useState<RivalVendor[]>([]);
  const [rivalsMessage, setRivalsMessage] = useState<string | null>(null);
  const [rivalsLoading, setRivalsLoading] = useState(false);
  const [selectedRivalId, setSelectedRivalId] = useState<number | null>(null);
  const [rivalResult, setRivalResult] = useState<CompetitorWordAnalysis | null>(null);
  const [rivalError, setRivalError] = useState<string | null>(null);
  const [rivalAnalyzing, setRivalAnalyzing] = useState(false);

  const loadRivals = async () => {
    setRivalsLoading(true);
    setRivalError(null);
    try {
      const data = await wordAnalysisApi.rivals();
      setRivals(data.rivals);
      setRivalsMessage(data.message || null);
      if (data.rivals.length > 0) setSelectedRivalId((prev) => prev ?? data.rivals[0].id);
    } catch (err) {
      setRivalError(err instanceof ApiError ? err.message : 'Could not load rival vendors');
    } finally {
      setRivalsLoading(false);
    }
  };

  useEffect(() => {
    if (lens === 'rival' && rivals.length === 0 && !rivalsLoading) loadRivals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lens]);

  const analyzeRival = async () => {
    if (!selectedRivalId) return;
    setRivalAnalyzing(true);
    setRivalError(null);
    try {
      setRivalResult(await wordAnalysisApi.vendor(selectedRivalId));
    } catch (err) {
      setRivalError(err instanceof ApiError ? err.message : 'Could not analyze that vendor');
    } finally {
      setRivalAnalyzing(false);
    }
  };

  // External / pasted reviews
  const [externalText, setExternalText] = useState('');
  const [externalLabel, setExternalLabel] = useState('');
  const [externalResult, setExternalResult] = useState<ExternalWordAnalysis | null>(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);

  const analyzeExternal = async () => {
    setExternalLoading(true);
    setExternalError(null);
    try {
      setExternalResult(await wordAnalysisApi.external(externalText, externalLabel));
    } catch (err) {
      setExternalError(err instanceof ApiError ? err.message : 'Could not analyze that text');
    } finally {
      setExternalLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-soft p-4">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Smart Competitor Word Analysis</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          See what customers complain about in your own reviews, in a rival's reviews (same category, already on
          SellSence), or in reviews you paste in from anywhere else on the web.
        </p>
      </div>

      <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-100 dark:border-gray-700 shadow-soft w-fit">
        {(
          [
            { key: 'own', label: 'Your reviews', icon: MessageSquareText },
            { key: 'rival', label: 'Rival on SellSence', icon: Swords },
            { key: 'external', label: 'Paste external reviews', icon: ClipboardPaste },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setLens(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              lens === key ? 'bg-accent-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {lens === 'own' && (
        <div className="space-y-4">
          {ownError && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm rounded-lg p-3">
              <AlertTriangle size={16} /> {ownError}
            </div>
          )}
          {own && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Stat value={own.totalReviews} label="total reviews" />
              <Stat value={own.avgRating || '—'} label="avg. rating" />
              <Stat value={own.reviewsAnalyzed} label={`rated ≤ ${own.ratingMax}`} />
            </div>
          )}
          <PhraseResults data={own} emptyHint="No negative reviews with comments yet - nothing to analyze." />
          <button
            onClick={loadOwn}
            disabled={ownLoading}
            className="flex items-center gap-2 rounded-lg bg-accent-500 text-white px-3 py-1.5 text-sm font-medium hover:bg-accent-600 disabled:opacity-60"
          >
            {ownLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>
      )}

      {lens === 'rival' && (
        <div className="space-y-4">
          {rivalError && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm rounded-lg p-3">
              <AlertTriangle size={16} /> {rivalError}
            </div>
          )}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-soft p-4">
            {rivalsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                <Loader2 size={16} className="animate-spin" /> Finding vendors in your category...
              </div>
            ) : rivals.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                {rivalsMessage || 'No other vendors found in your shop category yet.'}
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Rival shop (same category)</label>
                  <select
                    value={selectedRivalId ?? ''}
                    onChange={(e) => setSelectedRivalId(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-sm"
                  >
                    {rivals.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.shop_name || `Vendor #${r.id}`} — {r.negative_review_count} negative / {r.review_count} reviews
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={analyzeRival}
                  disabled={rivalAnalyzing}
                  className="flex items-center justify-center gap-2 rounded-lg bg-accent-500 text-white px-3 py-1.5 text-sm font-medium hover:bg-accent-600 disabled:opacity-60"
                >
                  {rivalAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Swords size={16} />}
                  Analyze rival
                </button>
              </div>
            )}
          </div>

          {rivalResult && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Stat value={rivalResult.totalReviews} label="their total reviews" />
                <Stat value={rivalResult.avgRating || '—'} label="their avg. rating" />
                <Stat value={rivalResult.reviewsAnalyzed} label={`rated ≤ ${rivalResult.ratingMax}`} />
              </div>
              <PhraseResults
                data={rivalResult}
                emptyHint={`No negative reviews with comments found for ${rivalResult.vendor.shop_name || 'this vendor'} yet.`}
              />
            </>
          )}
        </div>
      )}

      {lens === 'external' && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs rounded-lg p-3">
            We don't live-fetch Amazon/Flipkart listings - scraping breaks their terms of use and breaks again the
            moment their page layout changes. Instead, copy the review text from the listing (or anywhere else) and
            paste it below; one review per line works best.
          </div>
          {externalError && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm rounded-lg p-3">
              <AlertTriangle size={16} /> {externalError}
            </div>
          )}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-soft p-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Source label (optional)</label>
              <input
                type="text"
                value={externalLabel}
                onChange={(e) => setExternalLabel(e.target.value)}
                placeholder="e.g. Amazon — Rival Backpack Co."
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Pasted reviews</label>
              <textarea
                value={externalText}
                onChange={(e) => setExternalText(e.target.value)}
                rows={6}
                placeholder={'Battery life is terrible, dies in an hour\nZipper broke after one week of use\n...'}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-sm font-mono"
              />
            </div>
            <button
              onClick={analyzeExternal}
              disabled={externalLoading || externalText.trim().length < 10}
              className="flex items-center gap-2 rounded-lg bg-accent-500 text-white px-3 py-1.5 text-sm font-medium hover:bg-accent-600 disabled:opacity-60"
            >
              {externalLoading ? <Loader2 size={16} className="animate-spin" /> : <ClipboardPaste size={16} />}
              Analyze pasted reviews
            </button>
          </div>

          {externalResult && (
            <>
              <p className="text-xs text-gray-400 dark:text-gray-500">Source: {externalResult.sourceLabel}</p>
              <PhraseResults data={externalResult} emptyHint="Couldn't find any usable review text in that paste." />
            </>
          )}
        </div>
      )}
    </div>
  );
}
