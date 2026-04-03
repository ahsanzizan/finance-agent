import { FinancialAgent } from "./agents/financial.agent";
import { ollamaClient } from "./client";
import { ToolRegistry } from "./tools/registry";
import {
  calculatorDefinition,
  calculatorExecutor,
  echoDefinition,
  echoExecutor,
} from "./tools/stub.tool";

async function main() {
  const isAlive = await ollamaClient.health();

  if (!isAlive) {
    console.error("Ollama is not running");
    process.exit(1);
  }

  console.log(`Ollama is running. Model: ${ollamaClient.model}`);

  const registry = new ToolRegistry();
  registry
    .register(echoDefinition, echoExecutor)
    .register(calculatorDefinition, calculatorExecutor);

  const agent = new FinancialAgent(registry, {
    verbose: true,
    maxIterations: 5,
    systemPrompt:
      "You are a financial assistant. Use tools when asked to calculate or echo.",
  });

  const result = await agent.run("What is 1500000 * 4 / 12?");

  console.log(`Final Answer : ${result.finalAnswer}`);
  console.log(`Iterations   : ${result.iterations}`);
  console.log(`Duration     : ${result.totalDurationMs}ms`);
  console.log(`Tools Used   : ${result.toolsUsed.length}`);

  for (const t of result.toolsUsed) {
    console.log(`\n  🔧 ${t.toolName} (${t.durationMs}ms)`);
    console.log(`     Args   : ${JSON.stringify(t.arguments)}`);
    console.log(`     Result : ${t.result}`);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
