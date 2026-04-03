import { z } from "zod";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY ?? "";
const FINNHUB_BASE = "https://finnhub.io/api/v1";

const FinnhubQuoteSchema = z.object({
  c: z.number(), // Current price
  d: z.number().nullable(), // Change
  dp: z.number().nullable(), // Change percent
  h: z.number(), // Day high
  l: z.number(), // Day low
  o: z.number(), // Open
  pc: z.number(), // Previous close
  t: z.number(), // Timestamp
});

const FinnhubProfileSchema = z.object({
  name: z.string().optional(),
  ticker: z.string().optional(),
  exchange: z.string().optional(),
  currency: z.string().optional(),
  marketCapitalization: z.number().optional(),
  shareOutstanding: z.number().optional(),
  weburl: z.string().optional(),
  logo: z.string().optional(),
  finnhubIndustry: z.string().optional(),
});

const FinnhubMetricsSchema = z.object({
  metric: z
    .object({
      peBasicExclExtraTTM: z.number().nullable().optional(),
      peNormalizedAnnual: z.number().nullable().optional(),
      pbAnnual: z.number().nullable().optional(),
      epsBasicExclExtraItemsTTM: z.number().nullable().optional(),
      dividendYieldIndicatedAnnual: z.number().nullable().optional(),
      "52WeekHigh": z.number().nullable().optional(),
      "52WeekLow": z.number().nullable().optional(),
      revenueGrowthTTMYoy: z.number().nullable().optional(),
      grossMarginTTM: z.number().nullable().optional(),
    })
    .passthrough(),
});

export type QuoteData = {
  ticker: string;
  name: string;
  exchange: string;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  prevClose: number;
  marketCap: number | null;
  pe: number | null;
  forwardPe: number | null;
  pb: number | null;
  eps: number | null;
  dividendYield: number | null;
  week52High: number | null;
  week52Low: number | null;
  industry: string | null;
};

async function finnhubGet<T>(
  path: string,
  schema: z.ZodType<T>,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${FINNHUB_BASE}${path}`);
  url.searchParams.set("token", FINNHUB_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());

  if (res.status === 429) {
    throw new Error("Finnhub rate limit hit (60 req/min). Slow down requests.");
  }
  if (!res.ok) {
    throw new Error(`Finnhub API error ${res.status} for ${path}`);
  }

  const json = await res.json();
  return schema.parse(json);
}

/**
 * Fetch a full quote including fundamentals for any ticker.
 * Makes 3 concurrent Finnhub calls: quote + profile + metrics.
 */
export async function getQuote(ticker: string): Promise<QuoteData> {
  const symbol = ticker.toUpperCase().trim();

  // Fire all three requests concurrently
  const [quote, profile, metrics] = await Promise.all([
    finnhubGet("/quote", FinnhubQuoteSchema, { symbol }),
    finnhubGet("/stock/profile2", FinnhubProfileSchema, { symbol }),
    finnhubGet("/stock/metric", FinnhubMetricsSchema, {
      symbol,
      metric: "all",
    }),
  ]);

  const m = metrics.metric;

  return {
    ticker: symbol,
    name: profile.name ?? symbol,
    exchange: profile.exchange ?? "UNKNOWN",
    currency: profile.currency ?? "USD",
    price: round(quote.c),
    change: round(quote.d ?? 0),
    changePercent: round(quote.dp ?? 0),
    dayHigh: round(quote.h),
    dayLow: round(quote.l),
    open: round(quote.o),
    prevClose: round(quote.pc),
    marketCap: profile.marketCapitalization
      ? round(profile.marketCapitalization * 1e6, 0)
      : null,
    pe: m.peBasicExclExtraTTM ?? null,
    forwardPe: m.peNormalizedAnnual ?? null,
    pb: m.pbAnnual ?? null,
    eps: m.epsBasicExclExtraItemsTTM ?? null,
    dividendYield: m.dividendYieldIndicatedAnnual ?? null,
    week52High: m["52WeekHigh"] ?? null,
    week52Low: m["52WeekLow"] ?? null,
    industry: profile.finnhubIndustry ?? null,
  };
}

/**
 * Lightweight price-only fetch — used by calculateDca and getPortfolioSummary
 * to avoid burning the 3-call budget per ticker.
 */
export async function getPrice(ticker: string): Promise<{
  price: number;
  change: number;
  changePct: number;
  currency: string;
}> {
  const symbol = ticker.toUpperCase().trim();

  const [quote, profile] = await Promise.all([
    finnhubGet("/quote", FinnhubQuoteSchema, { symbol }),
    finnhubGet("/stock/profile2", FinnhubProfileSchema, { symbol }),
  ]);

  if (quote.c === 0) {
    throw new Error(
      `No price data for '${symbol}'. ` +
        `Check the ticker is valid and listed on a Finnhub-supported exchange.`,
    );
  }

  return {
    price: round(quote.c),
    change: round(quote.d ?? 0),
    changePct: round(quote.dp ?? 0),
    currency: profile.currency ?? "USD",
  };
}

function round(n: number, decimals = 2): number {
  return parseFloat(n.toFixed(decimals));
}
