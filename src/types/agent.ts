export interface AgentConfig {
  /** System prompt injected at position 0 of every request */
  systemPrompt: string;

  /** Cap on tool-call iterations per run to prevent infinite loops */
  maxIterations: number;

  /** Log each loop cycle to stdout for debugging */
  verbose: boolean;

  /** low = deterministic, high = creative */
  temperature: number;

  /** Context window size passed to Ollama */
  numCtx: number;
}

export interface ToolCallRecord {
  toolName: string;
  arguments: Record<string, unknown>;
  result: string;
  durationMs: number;
}

export interface AgentRunResult {
  finalAnswer: string;
  toolsUsed: ToolCallRecord[];
  iterations: number;
  totalDurationMs: number;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  systemPrompt:
    "You are a financial analysis assistant. Use the provided tools to answer questions accurately. Always call a tool if one is relevant before answering.",
  maxIterations: 10,
  verbose: true,
  temperature: 0.1,
  numCtx: 4096,
};
