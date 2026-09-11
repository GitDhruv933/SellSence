// routes/financialCalculator.js - Module 2: Smart Financial Calculator.
//
// Pure arithmetic (EMI/amortization math) - no AI call needed here, unlike
// businessReport.js. Every default below (interest rates, scheme
// thresholds, tenures, moratorium lengths) is an ILLUSTRATIVE placeholder,
// not a verified rate from any specific bank or government scheme - they
// are all overridable per-request, and the response always carries a
// disclaimer saying so. This is a planning calculator, not a loan
// pre-approval.
const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

const DEFAULTS = {
  own_contribution_pct: 10,          // "their 10%" per the brief
  micro_finance_max_project_cost: 1000000, // illustrative MSME-style cutoff (10 lakh)
  micro_finance_interest_pct: 10,    // illustrative, p.a.
  term_loan_interest_pct: 12,        // illustrative, p.a.
  micro_finance_tenure_months: 36,
  term_loan_tenure_months: 60,
  micro_finance_moratorium_months: 6,
  term_loan_moratorium_months: 12,
  working_capital_cycle_months: 2,
  working_capital_fallback_pct_of_project_cost: 20, // used only if no purchase history exists
};

function num(v, fallback) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

// Standard EMI formula for a fully-amortizing loan.
function calcEmi(principal, annualRatePct, months) {
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / months;
  const factor = Math.pow(1 + r, months);
  return (principal * r * factor) / (factor - 1);
}

// Builds a month-by-month schedule: interest-only during the moratorium
// (principal untouched, so the loan doesn't secretly grow), then a normal
// amortizing EMI for the remaining months.
function buildSchedule(principal, annualRatePct, totalMonths, moratoriumMonths) {
  const r = annualRatePct / 12 / 100;
  const schedule = [];
  let balance = principal;
  const amortMonths = Math.max(totalMonths - moratoriumMonths, 1);
  const emi = calcEmi(principal, annualRatePct, amortMonths);

  for (let m = 1; m <= moratoriumMonths; m += 1) {
    const interest = balance * r;
    schedule.push({
      month: m,
      phase: 'moratorium',
      opening_balance: round2(balance),
      payment: round2(interest),
      interest: round2(interest),
      principal_paid: 0,
      closing_balance: round2(balance),
    });
  }

  for (let m = 1; m <= amortMonths; m += 1) {
    const interest = balance * r;
    let principalPaid = emi - interest;
    if (m === amortMonths) principalPaid = balance; // clear any rounding residue on the last EMI
    const closing = Math.max(balance - principalPaid, 0);
    schedule.push({
      month: moratoriumMonths + m,
      phase: 'regular',
      opening_balance: round2(balance),
      payment: round2(m === amortMonths ? principalPaid + interest : emi),
      interest: round2(interest),
      principal_paid: round2(principalPaid),
      closing_balance: round2(closing),
    });
    balance = closing;
  }

  return { schedule, emi: round2(emi) };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// POST /financial-calculator/estimate
// Body: {
//   own_contribution: number (required - "their 10%"),
//   own_contribution_pct?: number (default 10),
//   interest_rate_pct?: number (override the scheme default),
//   tenure_months?: number (override the scheme default),
//   monthly_operating_expenses?: number (override the purchases-history estimate),
//   working_capital_cycle_months?: number,
//   micro_finance_max_project_cost?: number (override the scheme cutoff),
// }
router.post('/estimate', (req, res) => {
  const ownContribution = num(req.body.own_contribution, null);
  if (ownContribution === null || ownContribution <= 0) {
    return res.status(400).json({ error: 'own_contribution (a positive number) is required' });
  }
  const ownPct = num(req.body.own_contribution_pct, DEFAULTS.own_contribution_pct);
  if (ownPct <= 0 || ownPct > 100) {
    return res.status(400).json({ error: 'own_contribution_pct must be between 0 and 100' });
  }

  // --- Total project cost & loan eligibility ---
  const totalProjectCost = round2(ownContribution / (ownPct / 100));
  const loanAmount = round2(totalProjectCost - ownContribution);

  // --- Auto-pick scheme ---
  const microMax = num(req.body.micro_finance_max_project_cost, DEFAULTS.micro_finance_max_project_cost);
  const isMicroFinance = totalProjectCost <= microMax;
  const schemeName = isMicroFinance ? 'Micro Finance' : 'Term Loan';
  const schemeDefaults = isMicroFinance
    ? { rate: DEFAULTS.micro_finance_interest_pct, tenure: DEFAULTS.micro_finance_tenure_months, moratorium: DEFAULTS.micro_finance_moratorium_months }
    : { rate: DEFAULTS.term_loan_interest_pct, tenure: DEFAULTS.term_loan_tenure_months, moratorium: DEFAULTS.term_loan_moratorium_months };

  const interestRatePct = num(req.body.interest_rate_pct, schemeDefaults.rate);
  const tenureMonths = Math.round(num(req.body.tenure_months, schemeDefaults.tenure));
  const moratoriumMonths = Math.min(Math.round(num(req.body.moratorium_months, schemeDefaults.moratorium)), Math.max(tenureMonths - 1, 0));

  if (tenureMonths < 1) {
    return res.status(400).json({ error: 'tenure_months must be at least 1' });
  }

  const { schedule, emi } = buildSchedule(loanAmount, interestRatePct, tenureMonths, moratoriumMonths);
  const totalInterest = round2(schedule.reduce((sum, row) => sum + row.interest, 0));
  const totalRepayment = round2(loanAmount + totalInterest);

  // --- Working capital ---
  let monthlyOperatingExpenses = num(req.body.monthly_operating_expenses, null);
  let expenseSource = 'input';
  if (monthlyOperatingExpenses === null) {
    const purchaseTotal = db.prepare(
      `SELECT COALESCE(SUM(quantity * purchase_price), 0) AS total
       FROM purchases WHERE user_id = ? AND purchase_date >= datetime('now', '-90 days')`
    ).get(req.userId).total;
    if (purchaseTotal > 0) {
      monthlyOperatingExpenses = round2(purchaseTotal / 3);
      expenseSource = 'purchases_history_90d_avg';
    } else {
      monthlyOperatingExpenses = round2(totalProjectCost * (DEFAULTS.working_capital_fallback_pct_of_project_cost / 100) / 12);
      expenseSource = 'fallback_estimate';
    }
  }
  const wcCycleMonths = num(req.body.working_capital_cycle_months, DEFAULTS.working_capital_cycle_months);
  const workingCapitalNeeded = round2(monthlyOperatingExpenses * wcCycleMonths);

  res.json({
    inputs: {
      own_contribution: ownContribution,
      own_contribution_pct: ownPct,
    },
    total_project_cost: totalProjectCost,
    loan_amount: loanAmount,
    scheme: {
      name: schemeName,
      reason: isMicroFinance
        ? `Total project cost (₹${totalProjectCost}) is at or below the ₹${microMax} micro-finance cutoff used here.`
        : `Total project cost (₹${totalProjectCost}) is above the ₹${microMax} micro-finance cutoff used here, so a term loan is suggested instead.`,
    },
    interest_rate_pct: interestRatePct,
    tenure_months: tenureMonths,
    moratorium_months: moratoriumMonths,
    emi_after_moratorium: emi,
    total_interest_payable: totalInterest,
    total_repayment: totalRepayment,
    repayment_schedule: schedule,
    working_capital: {
      source: expenseSource, // 'input' | 'purchases_history_90d_avg' | 'fallback_estimate'
      monthly_operating_expenses: monthlyOperatingExpenses,
      cycle_months: wcCycleMonths,
      working_capital_needed: workingCapitalNeeded,
    },
    disclaimer: 'This is an illustrative planning estimate only, using configurable default rates/tenures/thresholds - it is not a loan offer, pre-approval, or financial advice. Confirm actual eligibility, interest rates, and scheme rules with your bank or lending institution.',
  });
});

module.exports = router;
