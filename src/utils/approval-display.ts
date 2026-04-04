type RiskLevel = "safe" | "moderate" | "destructive";

interface ToolRiskProfile {
  level: RiskLevel;
  description: string;
}

const TOOL_RISK_MAP: Record<string, ToolRiskProfile> = {
  get_stock_info: {
    level: "safe",
    description: "Read-only: fetches public market data",
  },
  calculate_dca: {
    level: "safe",
    description: "Read-only: runs a local calculation",
  },
  calculate_compound: {
    level: "safe",
    description: "Read-only: runs a local calculation",
  },
  get_portfolio_summary: {
    level: "moderate",
    description: "Fetches live prices for multiple tickers",
  },
  // execute_trade:  { level: "destructive", description: "Places a real order" }
  // send_report:    { level: "moderate",    description: "Sends an email" }
};

const RISK_COLORS: Record<RiskLevel, string> = {
  safe: "\x1b[32m", // Green
  moderate: "\x1b[33m", // Yellow
  destructive: "\x1b[31m", // Red
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

export function displayApprovalPrompt(
  toolName: string,
  parsedArgs: Record<string, unknown>,
  callIndex: number,
  totalCalls: number,
): void {
  const risk = TOOL_RISK_MAP[toolName] ?? {
    level: "moderate" as RiskLevel,
    description: "Unknown tool",
  };
  const color = RISK_COLORS[risk.level];
  const badge = `[${risk.level.toUpperCase()}]`;

  console.log("\n" + "─".repeat(60));
  console.log(
    `${BOLD}🔧 Tool Call ${callIndex}/${totalCalls}${RESET}  ` +
      `${color}${badge}${RESET}  ${DIM}${risk.description}${RESET}`,
  );
  console.log("─".repeat(60));
  console.log(`${BOLD}Tool:${RESET}  ${color}${toolName}${RESET}`);
  console.log(`${BOLD}Args:${RESET}`);

  for (const [key, value] of Object.entries(parsedArgs)) {
    const formatted =
      typeof value === "object"
        ? JSON.stringify(value, null, 2).split("\n").join("\n         ")
        : String(value);
    console.log(`  ${DIM}${key}:${RESET} ${formatted}`);
  }

  console.log("─".repeat(60));
}

export function displayApprovalResult(
  decision: "approved" | "rejected" | "edited",
  toolName: string,
): void {
  const icon = {
    approved: "✅",
    rejected: "❌",
    edited: "✏️",
  }[decision];

  console.log(`${icon}  ${decision.toUpperCase()}: ${toolName}\n`);
}
