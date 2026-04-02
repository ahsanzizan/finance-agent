import type { ConversationMessage, ToolCall, ToolDefinition } from "./tool";

export interface OllamaRequest {
  model: string;
  messages: ConversationMessage[];
  tools?: ToolDefinition[];
  stream: false;
  options?: {
    temperature?: number;
    num_ctx?: number;
  };
}

export interface OllamaResponseChoice {
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: ToolCall[];
  };
  finish_reason: "stop" | "tool_calls" | string;
}

export interface OllamaResponse {
  model: string;
  choices: OllamaResponseChoice[];
}
