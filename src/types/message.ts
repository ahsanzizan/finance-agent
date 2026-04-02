export type Role = "user" | "system" | "assistant" | "tool";

export interface TextMessage {
  role: Extract<Role, "user" | "system" | "assistant">;
  content: string;
}

export interface ToolMessage {
  role: "tool";
  content: string;
  toolCallId: string;
}

export type Message = TextMessage | ToolMessage;
