import { SupervisedFinancialAgent } from "./agents/supervised-financial.agent"; // ← swap here
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
import { getLogPath } from "./utils/audit-log";
import { closeReadline } from "./utils/prompt";

async function main() {
  console.log("Checking Ollama...");
  if (!(await ollamaClient.health())) {
    console.error("Ollama is not running.");
    process.exit(1);
  }
  console.log(`Connected | Model: ${ollamaClient.model}\n`);

  const registry = new ToolRegistry();
  registry
    .register(getStockInfoDefinition, getStockInfoExecutor)
    .register(calculateDcaDefinition, calculateDcaExecutor)
    .register(calculateCompoundDefinition, calculateCompoundExecutor)
    .register(getPortfolioSummaryDefinition, getPortfolioSummaryExecutor);

  const agent = new SupervisedFinancialAgent(registry, {
    maxIterations: 8,
    temperature: 0.1,
  });

  const result = await agent.run(
    "Get the current price of AAPL, then calculate a DCA of $500/month for 24 months.",
  );

  console.log("\n" + "═".repeat(60));
  console.log("FINAL ANSWER");
  console.log("═".repeat(60));
  console.log(result.finalAnswer);
  console.log(`\nIterations : ${result.iterations}`);
  console.log(`Duration   : ${result.totalDurationMs}ms`);
  console.log(`Audit log  : ${getLogPath()}`);

  closeReadline();
}

main().catch((err) => {
  closeReadline();
  console.error(err);
  process.exit(1);
});
