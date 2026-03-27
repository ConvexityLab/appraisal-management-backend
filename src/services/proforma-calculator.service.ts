/**
 * Proforma calculation engine — pure functions, no side effects (Phase 3.5)
 *
 * All financial calculations isolated here for testability.
 * Input: raw proforma assumptions
 * Output: derived financial metrics
 */

import type { ProformaCalculateRequest, ProformaCalculateResponse } from '../types/proforma.types.js';

/**
 * Calculate monthly mortgage payment (principal + interest) using standard amortisation formula.
 * Returns undefined if insufficient financing inputs provided.
 */
export function calcMonthlyMortgage(
  loanAmount: number | undefined,
  interestRate: number | undefined,
  loanTermMonths: number | undefined,
): number | undefined {
  if (!loanAmount || !interestRate || !loanTermMonths) return undefined;
  const r = interestRate / 100 / 12; // monthly rate
  if (r === 0) return loanAmount / loanTermMonths;
  return (loanAmount * r * Math.pow(1 + r, loanTermMonths)) / (Math.pow(1 + r, loanTermMonths) - 1);
}

/**
 * Calculate annualised net operating income for rental strategy.
 * NOI = (monthlyRent * 12 * (1 - vacancyRate/100)) - managementFees - annualExpenses
 */
export function calcNOI(
  monthlyRent: number | undefined,
  vacancyRate: number | undefined,
  managementFeeRate: number | undefined,
  annualExpenses: number | undefined,
): number | undefined {
  if (!monthlyRent) return undefined;
  const annualGross = monthlyRent * 12;
  const vacancy = vacancyRate !== undefined ? vacancyRate / 100 : 0.05;
  const mgmtFee = managementFeeRate !== undefined ? managementFeeRate / 100 : 0;
  const effectiveGross = annualGross * (1 - vacancy);
  const mgmt = effectiveGross * mgmtFee;
  const expenses = annualExpenses ?? 0;
  return effectiveGross - mgmt - expenses;
}

/**
 * Main proforma calculator.
 * Returns all derived financial metrics from raw inputs.
 */
export function calculateProforma(inputs: ProformaCalculateRequest): ProformaCalculateResponse {
  const totalInvestment = inputs.purchasePrice + inputs.closingCosts + inputs.rehabBudget;

  let netProfit = 0;
  let roi = 0;
  let cocReturn: number | undefined;
  let capRate: number | undefined;
  let monthlyCashFlow: number | undefined;
  const monthlyMortgage = calcMonthlyMortgage(inputs.loanAmount, inputs.interestRate, inputs.loanTermMonths);

  if (inputs.strategy === 'fix_and_flip' || inputs.strategy === 'wholesale') {
    const arv = inputs.arvEstimate ?? 0;
    const holdCosts = monthlyMortgage !== undefined && inputs.holdMonths !== undefined
      ? monthlyMortgage * inputs.holdMonths
      : 0;
    netProfit = arv - totalInvestment - holdCosts;
    roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;

    const downPayment = inputs.downPayment ?? totalInvestment;
    cocReturn = downPayment > 0 ? (netProfit / downPayment) * 100 : undefined;
  } else if (inputs.strategy === 'buy_and_hold' || inputs.strategy === 'brrrr') {
    const noi = calcNOI(inputs.monthlyRent, inputs.vacancyRate, inputs.managementFeeRate, inputs.annualExpenses);
    if (noi !== undefined) {
      capRate = totalInvestment > 0 ? (noi / totalInvestment) * 100 : 0;

      const annualDebtService = monthlyMortgage !== undefined ? monthlyMortgage * 12 : 0;
      const annualCashFlow = noi - annualDebtService;
      monthlyCashFlow = annualCashFlow / 12;

      const downPayment = inputs.downPayment ?? totalInvestment;
      cocReturn = downPayment > 0 ? (annualCashFlow / downPayment) * 100 : undefined;

      // For hold strategy, net profit is driven by appreciation — set to annualCashFlow as annual return
      netProfit = annualCashFlow;
      roi = totalInvestment > 0 ? (annualCashFlow / totalInvestment) * 100 : 0;
    }
  } else if (inputs.strategy === 'development') {
    const arv = inputs.arvEstimate ?? 0;
    netProfit = arv - totalInvestment;
    roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;
    const downPayment = inputs.downPayment ?? totalInvestment;
    cocReturn = downPayment > 0 ? (netProfit / downPayment) * 100 : undefined;
  }

  return {
    totalInvestment: Math.round(totalInvestment),
    netProfit: Math.round(netProfit),
    roi: Math.round(roi * 100) / 100,
    ...(cocReturn !== undefined ? { cocReturn: Math.round(cocReturn * 100) / 100 } : {}),
    ...(capRate !== undefined ? { capRate: Math.round(capRate * 100) / 100 } : {}),
    ...(monthlyMortgage !== undefined ? { monthlyMortgage: Math.round(monthlyMortgage) } : {}),
    ...(monthlyCashFlow !== undefined ? { monthlyCashFlow: Math.round(monthlyCashFlow) } : {}),
  };
}
