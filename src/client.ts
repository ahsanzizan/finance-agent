import { env } from "./env";
import { OllamaError } from "./error";
import type { OllamaRequest, OllamaResponse } from "./types/ollama";
import { parseToolArguments } from "./utils/parser";

export class OllamaClient {
  private baseUrl: string;
  public model: string;

  constructor() {
    this.baseUrl = env.OLLAMA_BASE_URL;
    this.model = env.OLLAMA_MODEL;
  }

  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch (error) {
      console.error("Ollama health check failed:", error);
      return false;
    }
  }

  async chat(
    req: Omit<OllamaRequest, "model" | "stream">,
  ): Promise<OllamaResponse> {
    const url = `${env.OLLAMA_BASE_URL}/v1/chat/completions`;

    const body: OllamaRequest = {
      ...req,
      model: this.model,
      stream: false,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new OllamaError(`Ollama API error ${res.status}: ${errorText}`);
    }

    return res.json() as Promise<OllamaResponse>;
  }

  // This is essentially just chat but with pre-parsed tool call arguments (at least that's the plan)
  async chatWithParsedTools(
    req: Omit<OllamaRequest, "model" | "stream">,
  ): Promise<OllamaResponse> {
    const response = await this.chat(req);

    for (const choice of response.choices) {
      const toolCalls = choice.message.tool_calls;
      if (!toolCalls) continue;

      for (const toolCall of toolCalls) {
        // Mutate the arguments in-place to ensure downstream code can parse the arguments
        const parsed = parseToolArguments(
          toolCall.function.arguments,
          toolCall.function.name,
        );

        toolCall.function.arguments = JSON.stringify(parsed);
      }
    }

    return response;
  }
}

export const ollamaClient = new OllamaClient();
