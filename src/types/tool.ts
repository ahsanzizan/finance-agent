import type { Message } from "./message";

export interface ToolCallFunction {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: ToolCallFunction;
}

export interface ToolCallMessage {
  role: "assistant";
  content: null;
  tool_calls: ToolCall[];
}

export type ConversationMessage = Message | ToolCallMessage;

export interface ToolParameterProperty {
  type: string;
  description: string;
  enum?: string[];
}

export interface ToolParameters {
  type: "object";
  properties: Record<string, ToolParameterProperty>;
  required: string[];
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: ToolParameters;
  };
}

export type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>;

export interface RegisteredTool {
  definition: ToolDefinition;
  executor: ToolExecutor;
}
