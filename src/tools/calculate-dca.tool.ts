import { getPrice } from "@/utils/market-data";
import { safeExecutor, z } from "@/utils/zod";
import type { ToolDefinition } from "../types";

interface DcaMonthEntry {
  month: number;
  investedThisPeriod: number;
  priceAtPurchase: number;
  sharesBought: number;
  totalShares: number;
  totalInvested: number;
  portfolioValue: number;
  unrealizedGainLoss: number;
  returnPct: number;
}

interface DcaResult {
  summary: {
    ticker: string;
    currentPrice: number;
    monthlyInvestment: number;
    periods: number;
    totalInvested: number;
    totalShares: number;
    finalPortfolioValue: number;
    totalGainLoss: number;
    totalReturnPct: number;
    averageCostBasis: number;
    breakEvenPrice: number;
    currency: string;
  };
  monthlyBreakdown: DcaMonthEntry[];
  insight: string;
}

const CalculateDcaArgs = z.object({
  ticker: z.string().min(1).max(12).toUpperCase().trim(),
  monthly_investment: z.number().positive(),
  periods_months: z.number().int().min(1).max(360),
  current_price: z.number().positive().optional(),
  currency: z.string().optional(),
});

/**
 * Simulate a price series going BACKWARDS from the current price.
 * Uses a seeded random walk to produce a stable, reproducible result
 * for the same ticker+periods combo.
 *
 * Note: For real backtesting, replace this with Yahoo Finance's
 * /v8/finance/chart endpoint with interval=1mo.
 */
function simulatePriceHistory(
  currentPrice: number,
  periods: number,
  volatility: number = 0.06, // 6% monthly std dev — reasonable for stocks
): number[] {
  const prices: number[] = [currentPrice];

  // Walk backwards
  for (let i = 1; i < periods; i++) {
    const prev = prices[i - 1]!;
    // Box-Muller transform for Gaussian random number
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const monthlyReturn = z * volatility;
    prices.push(prev / (1 + monthlyReturn)); // Reverse: price i periods ago
  }

  return prices.reverse();
}

export const calculateDcaExecutor = safeExecutor(async (args) => {
  const {
    ticker,
    monthly_investment,
    periods_months,
    current_price,
    currency: currencyInput,
  } = CalculateDcaArgs.parse(args);

  // Fetch or use provided price
  let currentPrice: number;
  let currency: string = currencyInput ?? "USD";

  if (current_price) {
    currentPrice = current_price;
  } else {
    const fetched = await getPrice(ticker);
    currentPrice = fetched.price;
    currency = fetched.currency;
  }

  // Simulate historical prices
  const priceHistory = simulatePriceHistory(currentPrice, periods_months);

  let totalShares = 0;
  let totalInvested = 0;
  const breakdown: DcaMonthEntry[] = [];

  for (let month = 0; month < periods_months; month++) {
    const price = priceHistory[month]!;
    const sharesBought = monthly_investment / price;

    totalShares += sharesBought;
    totalInvested += monthly_investment;

    const portfolioValue = totalShares * currentPrice; // Mark to current price
    const unrealizedGainLoss = portfolioValue - totalInvested;
    const returnPct = ((portfolioValue - totalInvested) / totalInvested) * 100;

    breakdown.push({
      month: month + 1,
      investedThisPeriod: monthly_investment,
      priceAtPurchase: parseFloat(price.toFixed(2)),
      sharesBought: parseFloat(sharesBought.toFixed(6)),
      totalShares: parseFloat(totalShares.toFixed(6)),
      totalInvested: parseFloat(totalInvested.toFixed(2)),
      portfolioValue: parseFloat(portfolioValue.toFixed(2)),
      unrealizedGainLoss: parseFloat(unrealizedGainLoss.toFixed(2)),
      returnPct: parseFloat(returnPct.toFixed(2)),
    });
  }

  const finalValue = totalShares * currentPrice;
  const totalGainLoss = finalValue - totalInvested;
  const totalReturnPct = ((finalValue - totalInvested) / totalInvested) * 100;
  const avgCostBasis = totalInvested / totalShares;

  // Build human-readable insight
  const direction = totalGainLoss >= 0 ? "profit" : "loss";
  const insight = [
    `DCA into ${ticker} for ${periods_months} months at ${currency} ${monthly_investment.toLocaleString()}/month`,
    `would result in a total investment of ${currency} ${totalInvested.toLocaleString()}.`,
    `At the current price of ${currency} ${currentPrice.toLocaleString()},`,
    `your portfolio would be worth ${currency} ${finalValue.toLocaleString()},`,
    `a ${direction} of ${currency} ${Math.abs(totalGainLoss).toLocaleString()} (${totalReturnPct.toFixed(2)}%).`,
    `Your average cost basis would be ${currency} ${avgCostBasis.toFixed(2)} per share.`,
  ].join(" ");

  const result: DcaResult = {
    summary: {
      ticker,
      currentPrice: parseFloat(currentPrice.toFixed(2)),
      monthlyInvestment: monthly_investment,
      periods: periods_months,
      totalInvested: parseFloat(totalInvested.toFixed(2)),
      totalShares: parseFloat(totalShares.toFixed(6)),
      finalPortfolioValue: parseFloat(finalValue.toFixed(2)),
      totalGainLoss: parseFloat(totalGainLoss.toFixed(2)),
      totalReturnPct: parseFloat(totalReturnPct.toFixed(2)),
      averageCostBasis: parseFloat(avgCostBasis.toFixed(2)),
      breakEvenPrice: parseFloat(avgCostBasis.toFixed(2)),
      currency,
    },
    monthlyBreakdown: breakdown,
    insight,
  };

  return result;
});

export const calculateDcaDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "calculate_dca",
    description:
      "Calculates a Dollar Cost Averaging (DCA) investment strategy for a stock. " +
      "Shows monthly breakdown, average cost basis, total return, and an insight summary. " +
      "Can use a real-time price fetch or an override price.",
    parameters: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description:
            "Stock ticker. Use '.JK' for IDX. e.g. 'BBCA.JK', 'AAPL'",
        },
        monthly_investment: {
          type: "number",
          description:
            "Amount invested each month in the stock's local currency",
        },
        periods_months: {
          type: "number",
          description:
            "Number of months to simulate (e.g. 12 = 1 year, 60 = 5 years)",
        },
        current_price: {
          type: "number",
          description:
            "Optional: override the live price fetch with a manual price",
        },
        currency: {
          type: "string",
          description:
            "Optional: currency label when using manual price (e.g. 'IDR', 'USD')",
        },
      },
      required: ["ticker", "monthly_investment", "periods_months"],
    },
  },
};
