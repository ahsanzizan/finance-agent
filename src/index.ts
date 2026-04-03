import { FinancialAgent } from "./agents/financial.agent";
import { ollamaClient } from "./client";
import {
  calculateCompoundDefinition,
  calculateCompoundExecutor,
  calculateDcaDefinition,
  calculateDcaExecutor,
  getPortfolioSummaryDefinition,
  getPortfolioSummaryExecutor,
  getStockInfoDefinition,
  getStockInfoExecutor,
} from "./tools";
import { ToolRegistry } from "./tools/registry";

async function main() {
  console.log("Checking Ollama...");
  if (!(await ollamaClient.health())) {
    console.error("Ollama is not running.");
    process.exit(1);
  }
  console.log(`Connected: Model ${ollamaClient.model}\n`);

  const registry = new ToolRegistry();
  registry
    .register(getStockInfoDefinition, getStockInfoExecutor)
    .register(calculateDcaDefinition, calculateDcaExecutor)
    .register(calculateCompoundDefinition, calculateCompoundExecutor)
    .register(getPortfolioSummaryDefinition, getPortfolioSummaryExecutor);

  const agent = new FinancialAgent(registry, {
    maxIterations: 8,
    temperature: 0.1,
  });

  const queries = [
    // Single tool
    `What is the current price and P/E ratio of Apple stock?`,

    // DCA for IDX — uses manual price to avoid Yahoo rate limits
    `If I invest IDR 1,000,000 per month into BBCA.JK at a price of IDR 9,200 for 24 months, what's my DCA result?`,

    // Compound interest
    `If I invest $10,000 at 8% annual interest compounded monthly for 20 years with $500 monthly contributions, what's the final amount?`,

    // Multi-tool chain: fetch stock THEN calculate DCA
    `Get the current price of MSFT, then calculate what a DCA of $500/month for 12 months would look like.`,
  ];

  // Run the first query by default
  const result = await agent.run(queries[0]!);

  console.log("\n" + "═".repeat(60));
  console.log("FINAL ANSWER");
  console.log("═".repeat(60));
  console.log(result.finalAnswer);
  console.log(
    `\nIterations: ${result.iterations} | Duration: ${result.totalDurationMs}ms`,
  );
  console.log(
    `Tools used: ${result.toolsUsed.map((t) => t.toolName).join(" → ")}`,
  );
}

main().catch(console.error);
