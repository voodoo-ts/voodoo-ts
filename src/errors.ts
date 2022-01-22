export class VVError extends Error {
  context: Record<string, unknown>;

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.context = context;
  }
}

export class RecursionLimitError extends VVError {}

export class ClassNotFoundError extends VVError {}

export class ClassNotDecoratedError extends VVError {}

export class ParseError extends VVError {}

export class RuntimeError extends VVError {}
