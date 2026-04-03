import { JsonParseError } from "@/error";
import { parseModelJson, parseToolArguments } from "@/utils/parser";
import { describe, expect, it } from "bun:test";

describe("parseModelJson", () => {
  it("parses clean JSON directly", () => {
    const result = parseModelJson<{ ticker: string }>('{"ticker": "BBCA"}');
    expect(result.ticker).toBe("BBCA");
  });

  it("strips json markdown fences", () => {
    const raw = '```json\n{"ticker": "BBCA", "period": "1y"}\n```';
    const result = parseModelJson<{ ticker: string; period: string }>(raw);
    expect(result.ticker).toBe("BBCA");
    expect(result.period).toBe("1y");
  });

  it("strips plain markdown fences", () => {
    const raw = '```\n{"amount": 500}\n```';
    const result = parseModelJson<{ amount: number }>(raw);
    expect(result.amount).toBe(500);
  });

  it("handles preamble yapping", () => {
    const raw =
      'Sure! Here are the arguments: {"ticker": "TLKM", "period": "6m"}';
    const result = parseModelJson<{ ticker: string }>(raw);
    expect(result.ticker).toBe("TLKM");
  });

  it("fixes trailing commas", () => {
    const raw = '{"ticker": "BMRI", "amount": 1000000,}';
    const result = parseModelJson<{ ticker: string; amount: number }>(raw);
    expect(result.amount).toBe(1000000);
  });

  it("fixes single quotes", () => {
    const raw = "{'ticker': 'BBRI', 'period': '1y'}";
    const result = parseModelJson<{ ticker: string }>(raw);
    expect(result.ticker).toBe("BBRI");
  });

  it("strips function call wrappers", () => {
    const raw = 'get_stock_price({"ticker": "ASII"})';
    const result = parseModelJson<{ ticker: string }>(raw);
    expect(result.ticker).toBe("ASII");
  });

  it("handles nested objects", () => {
    const raw = `
      Here is the tool call:
      \`\`\`json
      {
        "portfolio": {
          "ticker": "BBCA",
          "allocations": [0.4, 0.3, 0.3],
        }
      }
      \`\`\`
    `;
    const result = parseModelJson<{ portfolio: { ticker: string } }>(raw);
    expect(result.portfolio.ticker).toBe("BBCA");
  });

  it("throws JsonParseError with metadata on total failure", () => {
    expect(() => parseModelJson("this is not json at all!!")).toThrow(
      JsonParseError,
    );
  });
});

describe("parseToolArguments", () => {
  it("tags error with tool name on failure", () => {
    try {
      parseToolArguments("totally broken {{{{", "calculate_dca");
    } catch (err) {
      expect(err).toBeInstanceOf(JsonParseError);
      expect((err as JsonParseError).message).toContain("calculate_dca");
    }
  });
});
