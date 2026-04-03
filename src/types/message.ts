export type Role = "user" | "system" | "assistant" | "tool";

export interface TextMessage {
  role: Extract<Role, "user" | "system" | "assistant">;
  content: string;
}

export interface ToolResultMessage {
  role: "tool";
  content: string;
  tool_call_id: string;
}

export type Message = TextMessage | ToolResultMessage;
