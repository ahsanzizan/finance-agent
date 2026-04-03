import { getQuote } from "@/utils/market-data";
import { safeExecutor, z } from "@/utils/zod";
import type { ToolDefinition } from "../types";

const GetStockInfoArgs = z.object({
  ticker: z
    .string()
    .min(1)
    .max(12)
    .transform((val) => val.toUpperCase()),
});

function fmt(n: number | undefined | null, decimals = 2): number | null {
  if (n == null || isNaN(n)) return null;
  return parseFloat(n.toFixed(decimals));
}

function fmtMarketCap(n: number | null): string {
  if (!n) return "N/A";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toString();
}

export const getStockInfoExecutor = safeExecutor(async (args) => {
  const { ticker } = GetStockInfoArgs.parse(args);

  const q = await getQuote(ticker);

  const direction = q.changePercent >= 0 ? "+" : "";
  const summary = [
    `${q.name} (${q.ticker}) is trading at ${q.currency} ${q.price}`,
    `(${direction}${q.changePercent}% today).`,
    q.marketCap ? `Market cap: ${fmtMarketCap(q.marketCap)}.` : "",
    q.pe ? `Trailing P/E: ${q.pe}.` : "",
    q.dividendYield
      ? `Dividend yield: ${q.dividendYield}%.`
      : "No dividend data.",
    q.industry ? `Industry: ${q.industry}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { ...q, summary };
});

export const getStockInfoDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "get_stock_info",
    description:
      "Fetches real-time stock price, fundamentals, and key metrics for any ticker. " +
      "For Indonesian IDX stocks, append '.JK' suffix (e.g. 'BBCA.JK', 'TLKM.JK'). " +
      "For US stocks use plain ticker (e.g. 'AAPL', 'MSFT').",
    parameters: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description:
            "Stock ticker symbol. Use '.JK' suffix for IDX stocks. " +
            "Examples: 'BBCA.JK', 'AAPL', 'TLKM.JK', 'MSFT'",
        },
      },
      required: ["ticker"],
    },
  },
};
