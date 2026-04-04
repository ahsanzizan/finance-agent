// src/agents/financialAgent.ts
import { ollamaClient } from "../client";
import { ToolRegistry } from "../tools/registry";
import type {
  AgentConfig,
  AgentRunResult,
  AssistantToolCallMessage,
  ConversationMessage,
  ToolCallRecord,
  ToolResultMessage,
} from "../types";
import { DEFAULT_AGENT_CONFIG } from "../types";

export class FinancialAgent {
  private registry: ToolRegistry;
  private config: AgentConfig;
  private history: ConversationMessage[] = [];

  constructor(registry: ToolRegistry, config: Partial<AgentConfig> = {}) {
    this.registry = registry;
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
  }

  // Should be the main entry point
  async run(userQuery: string): Promise<AgentRunResult> {
    const startTime = Date.now();
    const toolsUsed: ToolCallRecord[] = [];

    // Initialize conversation history
    // The system message should ALWAYS be at index 0
    const history: ConversationMessage[] = [
      { role: "system", content: this.config.systemPrompt },
      { role: "user", content: userQuery },
    ];

    this.log(`\n${"═".repeat(60)}`);
    this.log(`Agent starting | Query: "${userQuery}"`);
    this.log(`Available tools: ${this.registry.listNames().join(", ")}`);
    this.log(`${"═".repeat(60)}\n`);

    let iterations = 0;

    while (iterations < this.config.maxIterations) {
      iterations++;
      this.log(`\n── Iteration ${iterations}/${this.config.maxIterations} ──`);

      // Call the model with full history
      const response = await ollamaClient.chatWithParsedTools({
        messages: history,
        tools: this.registry.getDefinitions(),
        options: {
          temperature: this.config.temperature,
          num_ctx: this.config.numCtx,
        },
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error("Ollama returned an empty choices array.");
      }

      const { message, finish_reason } = choice;
      this.log(`finish_reason: ${finish_reason}`);

      if (finish_reason === "stop" || !message.tool_calls?.length) {
        const finalAnswer = message.content ?? "(no response)";
        this.log(`\nAgent finished in ${iterations} iteration(s)`);
        this.log(`Final answer: ${finalAnswer}\n`);

        return {
          finalAnswer,
          toolsUsed,
          iterations,
          totalDurationMs: Date.now() - startTime,
        };
      }

      // Model wants to call tools
      // Push the assistant's tool-call message into history FIRST
      // The assistant message is required by the OpenAI message spec
      // with tool_calls must appear BEFORE the tool result messages
      const assistantMessage: AssistantToolCallMessage = {
        role: "assistant",
        content: null, // Must be null, not empty string
        tool_calls: message.tool_calls,
      };
      history.push(assistantMessage);

      this.log(`Model requested ${message.tool_calls.length} tool call(s):`);

      // Execute each tool call and push results into history
      for (const toolCall of message.tool_calls) {
        const { name, arguments: rawArgs } = toolCall.function;

        this.log(`  -> Calling: ${name}(${rawArgs.slice(0, 80)}...)`);

        const toolStart = Date.now();

        const approved = await this.requestApproval(name, rawArgs);
        if (!approved) {
          const rejectionResult: ToolResultMessage = {
            role: "tool",
            content: JSON.stringify({ error: "User rejected this tool call." }),
            tool_call_id: toolCall.id,
          };
          history.push(rejectionResult);
          this.log(`   Tool call rejected by user`);
          continue;
        }

        const effectiveArgs = this.consumePendingEdit() ?? rawArgs;

        const resultJson = await this.registry.execute(name, effectiveArgs);
        const durationMs = Date.now() - toolStart;

        this.log(`   Result (${durationMs}ms): ${resultJson.slice(0, 120)}`);

        toolsUsed.push({
          toolName: name,
          arguments: JSON.parse(effectiveArgs) as Record<string, unknown>,
          result: resultJson,
          durationMs,
        });

        const toolResultMessage: ToolResultMessage = {
          role: "tool",
          content: resultJson,
          tool_call_id: toolCall.id,
        };
        history.push(toolResultMessage);
      }
    }

    // If we hit maxIterations, return whatever partial answer we have
    const lastContent =
      history
        .filter(
          (m): m is ConversationMessage & { content: string } =>
            "content" in m && typeof m.content === "string",
        )
        .at(-1)?.content ?? "(max iterations reached with no final answer)";

    console.warn(
      `Max iterations hit (${this.config.maxIterations}) without stopping.`,
    );

    return {
      finalAnswer: lastContent,
      toolsUsed,
      iterations,
      totalDurationMs: Date.now() - startTime,
    };
  }

  protected async requestApproval(
    _toolName: string,
    _rawArgs: string,
  ): Promise<boolean> {
    return true;
  }

  private log(msg: string): void {
    if (this.config.verbose) console.log(msg);
  }
  getHistory(): ConversationMessage[] {
    return [...(this.history ?? [])];
  }

  protected consumePendingEdit(): string | null {
    return null;
  }
}
