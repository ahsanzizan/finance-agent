import { JsonParseError } from "@/error";
import { parseToolArguments } from "@/utils/parser";
import type { RegisteredTool, ToolDefinition, ToolExecutor } from "../types";

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  register(definition: ToolDefinition, executor: ToolExecutor): this {
    const name = definition.function.name;

    if (this.tools.has(name)) {
      throw new Error(
        `Tool '${name}' is already registered. Names must be unique.`,
      );
    }

    this.tools.set(name, { definition, executor });
    console.log(`🔧 Registered tool: ${name}`);
    return this;
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /**
   * Execute a tool by name with pre-parsed arguments.
   * Returns a JSON string result (what (hopefully) gets pushed into history).
   */
  async execute(name: string, rawArguments: string): Promise<string> {
    const tool = this.tools.get(name);

    if (!tool) {
      // Return an error the model can reason about
      return JSON.stringify({
        error: `Unknown tool '${name}'. Available tools: ${this.listNames().join(", ")}`,
      });
    }

    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = parseToolArguments(rawArguments, name);
    } catch (err) {
      if (err instanceof JsonParseError) {
        return JSON.stringify({
          error: `Failed to parse arguments for tool '${name}': ${err.message}`,
          stage: err.stage,
          rawInput: err.raw.slice(0, 100),
        });
      }
      throw err;
    }

    try {
      const result = await tool.executor(parsedArgs);
      return JSON.stringify(result);
    } catch (err) {
      // Tool execution errors shouldn't crash the loop as far as I know
      return JSON.stringify({
        error: `Tool '${name}' threw an error during execution.`,
        details: (err as Error).message,
      });
    }
  }

  listNames(): string[] {
    return Array.from(this.tools.keys());
  }

  size(): number {
    return this.tools.size;
  }
}
