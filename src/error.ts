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

export class JsonParseError extends Error {
  public readonly raw: string;
  public readonly stage: string;

  constructor(message: string, raw: string, stage: string) {
    super(message);
    this.name = "JsonParseError";
    this.raw = raw;
    this.stage = stage;
  }
}
