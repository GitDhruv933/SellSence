import { useState } from 'react';
import { Calculator, Loader2, AlertTriangle, Info } from 'lucide-react';
import { ApiError, financialCalculatorApi } from '@/api/client';
import type { FinancialEstimate } from '@/api/types';

// Module 2: Smart Financial Calculator.
// Every rate/tenure/threshold used here is an illustrative default the
// backend applies unless overridden — this tool is for planning, not a
// loan pre-approval. See the disclaimer rendered at the bottom of the
// result, which comes straight from the API response.

function fmtInr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function FinancialCalculator() {
  const [ownContribution, setOwnContribution] = useState('');
  const [ownPct, setOwnPct] = useState('10');
  const [interestOverride, setInterestOverride] = useState('');
  const [tenureOverride, setTenureOverride] = useState('');
  const [monthlyExpenseOverride, setMonthlyExpenseOverride] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);

  const [result, setResult] = useState<FinancialEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculate = async () => {
    const contribution = Number(ownContribution);
    if (!ownContribution || Number.isNaN(contribution) || contribution <= 0) {
      setError('Enter your available amount (a positive number) first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body: Parameters<typeof financialCalculatorApi.estimate>[0] = {
        own_contribution: contribution,
      };
      if (ownPct.trim() !== '') body.own_contribution_pct = Number(ownPct);
      if (interestOverride.trim() !== '') body.interest_rate_pct = Number(interestOverride);
      if (tenureOverride.trim() !== '') body.tenure_months = Number(tenureOverride);
      if (monthlyExpenseOverride.trim() !== '') body.monthly_operating_expenses = Number(monthlyExpenseOverride);

      const data = await financialCalculatorApi.estimate(body);
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not calculate the estimate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-soft p-4">
        <h2 className="font-semibold text-gray-800 mb-1">Smart Financial Calculator</h2>
        <p className="text-xs text-gray-500 mb-4">
          Enter what you already have available - the calculator works out total project cost, loan
          eligibility, the right scheme, and a repayment plan.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Your available money (₹)</label>
            <input
              type="number"
              value={ownContribution}
              onChange={(e) => setOwnContribution(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Your share (%)</label>
            <input
              type="number"
              value={ownPct}
              onChange={(e) => setOwnPct(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Interest %/yr (optional)</label>
            <input
              type="number"
              value={interestOverride}
              onChange={(e) => setInterestOverride(e.target.value)}
              placeholder="auto"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tenure, months (optional)</label>
            <input
              type="number"
              value={tenureOverride}
              onChange={(e) => setTenureOverride(e.target.value)}
              placeholder="auto"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Monthly running expenses, ₹ (optional)</label>
            <input
              type="number"
              value={monthlyExpenseOverride}
              onChange={(e) => setMonthlyExpenseOverride(e.target.value)}
              placeholder="auto from your purchase history"
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <button
          onClick={calculate}
          disabled={loading}
          className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-accent-500 text-white px-3 py-1.5 text-sm font-medium hover:bg-accent-600 disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
          Calculate
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm rounded-lg p-3">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-soft p-3 text-center">
              <div className="text-lg font-bold text-gray-800">{fmtInr(result.total_project_cost)}</div>
              <div className="text-xs text-gray-500">total project cost</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-soft p-3 text-center">
              <div className="text-lg font-bold text-accent-600">{fmtInr(result.loan_amount)}</div>
              <div className="text-xs text-gray-500">max loan eligibility</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-soft p-3 text-center">
              <div className="text-lg font-bold text-gray-800">{result.scheme.name}</div>
              <div className="text-xs text-gray-500">suggested scheme</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-soft p-3 text-center">
              <div className="text-lg font-bold text-gray-800">{fmtInr(result.emi_after_moratorium)}</div>
              <div className="text-xs text-gray-500">EMI after moratorium</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-soft p-4">
            <h3 className="font-semibold text-gray-800 mb-2">Loan terms</h3>
            <p className="text-sm text-gray-600 mb-3">{result.scheme.reason}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-400">Interest rate</span><br />{result.interest_rate_pct}% p.a.</div>
              <div><span className="text-gray-400">Tenure</span><br />{result.tenure_months} months</div>
              <div><span className="text-gray-400">Moratorium</span><br />{result.moratorium_months} months</div>
              <div><span className="text-gray-400">Total interest</span><br />{fmtInr(result.total_interest_payable)}</div>
            </div>
            <button
              onClick={() => setShowSchedule((s) => !s)}
              className="mt-3 text-xs text-accent-600 hover:underline"
            >
              {showSchedule ? 'Hide' : 'Show'} full repayment schedule ({result.repayment_schedule.length} months)
            </button>
            {showSchedule && (
              <div className="mt-2 max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-gray-400">
                      <th className="py-1">Month</th>
                      <th className="py-1">Phase</th>
                      <th className="py-1">Payment</th>
                      <th className="py-1">Interest</th>
                      <th className="py-1">Principal</th>
                      <th className="py-1">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.repayment_schedule.map((row) => (
                      <tr key={row.month} className="border-t border-gray-50">
                        <td className="py-1">{row.month}</td>
                        <td className="py-1 capitalize">{row.phase}</td>
                        <td className="py-1">{fmtInr(row.payment)}</td>
                        <td className="py-1">{fmtInr(row.interest)}</td>
                        <td className="py-1">{fmtInr(row.principal_paid)}</td>
                        <td className="py-1">{fmtInr(row.closing_balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-soft p-4">
            <h3 className="font-semibold text-gray-800 mb-2">Working capital</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div><span className="text-gray-400">Monthly running expenses</span><br />{fmtInr(result.working_capital.monthly_operating_expenses)}</div>
              <div><span className="text-gray-400">Working capital cycle</span><br />{result.working_capital.cycle_months} months</div>
              <div><span className="text-gray-400">Working capital needed</span><br />{fmtInr(result.working_capital.working_capital_needed)}</div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {result.working_capital.source === 'purchases_history_90d_avg'
                ? 'Based on your last 90 days of recorded purchases.'
                : result.working_capital.source === 'fallback_estimate'
                ? 'No purchase history yet, so this is a rule-of-thumb estimate - enter your own monthly expenses above for a more accurate number.'
                : 'Based on the monthly expenses you entered.'}
            </p>
          </div>

          <div className="flex items-start gap-2 bg-amber-50 text-amber-800 text-xs rounded-lg p-3">
            <Info size={14} className="mt-0.5 shrink-0" />
            {result.disclaimer}
          </div>
        </>
      )}
    </div>
  );
}
