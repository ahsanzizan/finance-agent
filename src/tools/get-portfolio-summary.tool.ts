import { getPrice } from "@/utils/market-data";
import { safeExecutor, z } from "@/utils/zod";
import type { ToolDefinition } from "../types";

interface Position {
  ticker: string;
  shares: number;
  avgCost: number;
}

interface PositionResult {
  ticker: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  currency: string;
  costBasis: number;
  marketValue: number;
  gainLoss: number;
  gainLossPct: number;
  allocation: number; // % of total portfolio
  dayChange: number;
  dayChangePct: number;
}

interface PortfolioResult {
  positions: PositionResult[];
  totalCostBasis: number;
  totalMarketValue: number;
  totalGainLoss: number;
  totalReturnPct: number;
  bestPerformer: string;
  worstPerformer: string;
  insight: string;
  fetchErrors: string[];
}

const PositionSchema = z.object({
  ticker: z.string().min(1).toUpperCase().trim(),
  shares: z.number().positive(),
  avg_cost: z.number().positive(),
});

const GetPortfolioSummaryArgs = z.object({
  positions: z.array(PositionSchema).min(1).max(20),
});

export const getPortfolioSummaryExecutor = safeExecutor(async (args) => {
  const { positions: rawPositions } = GetPortfolioSummaryArgs.parse(args);

  // Parse and validate each position
  const positions: Position[] = [];
  for (const p of rawPositions) {
    if (typeof p !== "object" || p === null) continue;
    const obj = p as Record<string, unknown>;
    const ticker = String(obj["ticker"] ?? "")
      .toUpperCase()
      .trim();
    const shares = Number(obj["shares"] ?? 0);
    const avgCost = Number(obj["avg_cost"] ?? 0);

    if (
      !ticker ||
      isNaN(shares) ||
      shares <= 0 ||
      isNaN(avgCost) ||
      avgCost <= 0
    ) {
      return { error: `Invalid position entry: ${JSON.stringify(p)}` };
    }
    positions.push({ ticker, shares, avgCost });
  }

  // Fetch all prices concurrently
  const quotes = await Promise.all(
    positions.map(async (p) => {
      try {
        return await getPrice(p.ticker);
      } catch (error) {
        return null;
      }
    }),
  );

  const results: PositionResult[] = [];
  const fetchErrors: string[] = [];
  let totalCost = 0;
  let totalValue = 0;

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]!;
    const quote = quotes[i];

    if (!quote) {
      fetchErrors.push(`Failed to fetch price for ${pos.ticker}`);
      continue;
    }

    const costBasis = pos.shares * pos.avgCost;
    const marketValue = pos.shares * quote.price;
    const gainLoss = marketValue - costBasis;
    const gainLossPct = ((marketValue - costBasis) / costBasis) * 100;

    totalCost += costBasis;
    totalValue += marketValue;

    results.push({
      ticker: pos.ticker,
      shares: pos.shares,
      avgCost: pos.avgCost,
      currentPrice: parseFloat(quote.price.toFixed(2)),
      currency: quote.currency,
      costBasis: parseFloat(costBasis.toFixed(2)),
      marketValue: parseFloat(marketValue.toFixed(2)),
      gainLoss: parseFloat(gainLoss.toFixed(2)),
      gainLossPct: parseFloat(gainLossPct.toFixed(2)),
      allocation: 0, // Calculated after total is known
      dayChange: parseFloat((pos.shares * quote.change).toFixed(2)),
      dayChangePct: parseFloat(quote.changePct.toFixed(2)),
    });
  }

  // Back-fill allocation percentages
  for (const r of results) {
    r.allocation = parseFloat(((r.marketValue / totalValue) * 100).toFixed(2));
  }

  const sorted = [...results].sort((a, b) => b.gainLossPct - a.gainLossPct);
  const best = sorted[0]?.ticker ?? "N/A";
  const worst = sorted.at(-1)?.ticker ?? "N/A";
  const totalReturn = ((totalValue - totalCost) / totalCost) * 100;

  const insight = [
    `Portfolio of ${results.length} positions:`,
    `total invested ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })},`,
    `current value ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    `(${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%).`,
    `Best performer: ${best} (+${sorted[0]?.gainLossPct.toFixed(2)}%).`,
    `Worst performer: ${worst} (${sorted.at(-1)?.gainLossPct.toFixed(2)}%).`,
  ].join(" ");

  const portfolio: PortfolioResult = {
    positions: results,
    totalCostBasis: parseFloat(totalCost.toFixed(2)),
    totalMarketValue: parseFloat(totalValue.toFixed(2)),
    totalGainLoss: parseFloat((totalValue - totalCost).toFixed(2)),
    totalReturnPct: parseFloat(totalReturn.toFixed(2)),
    bestPerformer: best,
    worstPerformer: worst,
    insight,
    fetchErrors,
  };

  return portfolio;
});

export const getPortfolioSummaryDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "get_portfolio_summary",
    description:
      "Analyzes a stock portfolio. Fetches live prices for each position and returns " +
      "gain/loss, allocation percentages, best/worst performers, and a portfolio insight. " +
      "Accepts up to 20 positions.",
    parameters: {
      type: "object",
      properties: {
        positions: {
          type: "array",
          description: "Array of portfolio positions",
          items: {
            type: "object",
            description: "Stock position",
            properties: {
              ticker: {
                type: "string",
                description: "Stock ticker (e.g. 'BBCA.JK', 'AAPL')",
              },
              shares: { type: "number", description: "Number of shares held" },
              avg_cost: {
                type: "number",
                description: "Average purchase price per share",
              },
            },
          },
        },
      },
      required: ["positions"],
    },
  },
};
