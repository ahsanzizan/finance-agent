export { z, ZodError } from "zod";

import { ZodError } from "zod";
import type { ToolExecutor } from "../types";

export function safeExecutor(
  fn: (args: Record<string, unknown>) => Promise<unknown>,
): ToolExecutor {
  return async (args) => {
    try {
      return await fn(args);
    } catch (err) {
      if (err instanceof ZodError) {
        return {
          error: "Invalid tool arguments.",
          issues: err.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
          type: "ValidationError",
        };
      }
      return {
        error: "Tool execution failed unexpectedly.",
        details: (err as Error).message,
        type: "ExecutionError",
      };
    }
  };
}
