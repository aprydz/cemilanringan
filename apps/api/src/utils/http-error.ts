export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errors: Array<{ field?: string; message: string }> = [],
  ) {
    super(message)
    this.name = 'HttpError'
  }
}