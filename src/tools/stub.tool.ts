import type { ToolDefinition, ToolExecutor } from "../types";

export const echoDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "echo",
    description:
      "Echoes back the input message. Use this to confirm tool calling works.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message to echo back",
        },
      },
      required: ["message"],
    },
  },
};

export const echoExecutor: ToolExecutor = async (args) => {
  const message = args["message"] as string;
  return { echoed: message, timestamp: new Date().toISOString() };
};

export const calculatorDefinition: ToolDefinition = {
  type: "function",
  function: {
    name: "calculate",
    description:
      "Performs basic arithmetic. Useful for financial calculations.",
    parameters: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          description: "The operation to perform",
          enum: ["add", "subtract", "multiply", "divide"],
        },
        a: { type: "number", description: "First operand" },
        b: { type: "number", description: "Second operand" },
      },
      required: ["operation", "a", "b"],
    },
  },
};

export const calculatorExecutor: ToolExecutor = async (args) => {
  const op = args["operation"] as string;
  const a = args["a"] as number;
  const b = args["b"] as number;

  switch (op) {
    case "add":
      return { result: a + b, expression: `${a} + ${b}` };
    case "subtract":
      return { result: a - b, expression: `${a} - ${b}` };
    case "multiply":
      return { result: a * b, expression: `${a} × ${b}` };
    case "divide":
      if (b === 0) return { error: "Division by zero" };
      return { result: a / b, expression: `${a} ÷ ${b}` };
    default:
      return { error: `Unknown operation: ${op}` };
  }
};
