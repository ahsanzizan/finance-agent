import { safeExecutor, z } from "@/utils/zod";
import type { ToolDefinition } from "../types";

type CompoundFrequency =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "ANNUALLY";

const FREQUENCY_MAP: Record<CompoundFrequency, number> = {
  DAILY: 365,
  WEEKLY: 52,
  MONTHLY: 12,
  QUARTERLY: 4,
  ANNUALLY: 1,
};

interface YearlyBreakdown {
  year: number;
  startBalance: number;
  interestEarned: number;
  contributions: number;
  endBalance: number;
  totalInterestToDate: number;
}

interface CompoundResult {
  summary: {
    principal: number;
    annualRate: number;
    years: number;
    compoundFrequency: string;
    monthlyContribution: number;
    finalBalance: number;
    totalContributions: number;
    totalInterest: number;
    effectiveAnnualRate: number;
    doublingYears: number;
  };
  yearlyBreakdown: YearlyBreakdown[];
  insight: string;
}

const CompoundFrequency = z.enum([
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "ANNUALLY",
]);

const CalculateCompoundArgs = z.object({
  principal: z.number().nonnegative(),
  annual_rate: z.number().min(0).max(100),
  years: z.number().int().min(1).max(100),
  compound_frequency: CompoundFrequency,
  monthly_contribution: z.number().nonnegative().optional().default(0),
});

export const calculateCompoundExecutor = safeExecutor(async (args) => {
  const {
    principal,
    annual_rate: annualRate,
    years,
    compound_frequency: frequency,
    monthly_contribution: monthlyContrib,
  } = CalculateCompoundArgs.parse(args);

  const n = FREQUENCY_MAP[frequency];
  const r = annualRate / 100;

  // Effective annual rate (accounts for compounding frequency)
  const effectiveAnnualRate = (Math.pow(1 + r / n, n) - 1) * 100;

  // Doubling time via Rule of 72 (approximation)
  const doublingYears = annualRate > 0 ? 72 / annualRate : Infinity;

  const breakdown: YearlyBreakdown[] = [];
  let balance = principal;
  let totalInterest = 0;
  let totalContribs = principal; // Track all money in

  for (let year = 1; year <= years; year++) {
    const startBalance = balance;
    let yearlyInterest = 0;

    // Compound in sub-periods
    for (let period = 0; period < n; period++) {
      const interest = balance * (r / n);
      yearlyInterest += interest;
      balance += interest;

      // Add monthly contributions at monthly intervals
      if (frequency !== "ANNUALLY") {
        const monthsPerPeriod = 12 / n;
        balance += monthlyContrib * monthsPerPeriod;
        totalContribs += monthlyContrib * monthsPerPeriod;
      }
    }

    // For annual compounding, add yearly contribution lump sum
    if (frequency === "ANNUALLY" && year < years) {
      balance += monthlyContrib * 12;
      totalContribs += monthlyContrib * 12;
    }

    totalInterest += yearlyInterest;

    breakdown.push({
      year,
      startBalance: parseFloat(startBalance.toFixed(2)),
      interestEarned: parseFloat(yearlyInterest.toFixed(2)),
      contributions: parseFloat((monthlyContrib * 12).toFixed(2)),
      endBalance: parseFloat(balance.toFixed(2)),
      totalInterestToDate: parseFloat(totalInterest.toFixed(2)),
    });
  }

  const insight = [
    `${principal.toLocaleString()} compounded ${frequency.toLowerCase()} at ${annualRate}% per year`,
    `for ${years} years`,
    monthlyContrib > 0
      ? `with ${monthlyContrib.toLocaleString()} monthly contributions`
      : "",
    `grows to ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`,
    `Total interest earned: ${totalInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`,
    annualRate > 0
      ? `At this rate, money doubles approximately every ${doublingYears.toFixed(1)} years (Rule of 72).`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const result: CompoundResult = {
    summary: {
      principal,
      annualRate,
      years,
      compoundFrequency: frequency,
      monthlyContribution: monthlyContrib,
      finalBalance: parseFloat(balance.toFixed(2)),
      totalContributions: parseFloat(totalContribs.toFixed(2)),
      totalInterest: parseFloat(totalInterest.toFixed(2)),
      effectiveAnnualRate: parseFloat(effectiveAnnualRate.toFixed(4)),
      doublingYears: parseFloat(doublingYears.toFixed(1)),
    },
    yearlyBreakdown: breakdown,
    insight,
  };

  return result;
});

export const calculateCompoundDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "calculate_compound",
    description:
      "Calculates compound interest with optional recurring contributions. " +
      "Returns yearly breakdown, effective annual rate, doubling time, and total interest earned.",
    parameters: {
      type: "object",
      properties: {
        principal: {
          type: "number",
          description: "Initial investment amount",
        },
        annual_rate: {
          type: "number",
          description:
            "Annual interest rate as a percentage (e.g. 7.5 for 7.5%)",
        },
        years: {
          type: "number",
          description: "Investment duration in years",
        },
        compound_frequency: {
          type: "string",
          description: "How often interest is compounded",
          enum: ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY"],
        },
        monthly_contribution: {
          type: "number",
          description: "Optional: additional amount added each month",
        },
      },
      required: ["principal", "annual_rate", "years", "compound_frequency"],
    },
  },
};
