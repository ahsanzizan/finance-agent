export class AgentError extends Error {
  constructor(
    public override message: string,
    public errors?: unknown,
  ) {
    super(message);
    this.name = "AgentError";
  }
}

export class OllamaError extends Error {
  constructor(
    public override message: string,
    public statusCode?: number,
    public errors?: unknown,
  ) {
    super(message);
    this.name = "OllamaError";
  }
}
