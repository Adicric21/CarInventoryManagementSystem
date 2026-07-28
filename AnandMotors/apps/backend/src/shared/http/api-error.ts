export type ErrorDetails = Readonly<Record<string, unknown>>;

export class ApiError<TCode extends string = string> extends Error {
  constructor(
    public readonly status: number,
    public readonly code: TCode,
    message: string,
    public readonly details: ErrorDetails = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
