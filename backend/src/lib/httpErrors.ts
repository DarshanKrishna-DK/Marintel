export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly expose: boolean;

  constructor(opts: { statusCode: number; code: string; message: string; expose?: boolean }) {
    super(opts.message);
    this.name = "AppError";
    this.statusCode = opts.statusCode;
    this.code = opts.code;
    const defaultExpose = opts.statusCode < 500 || opts.statusCode === 501 || opts.statusCode === 503;
    this.expose = opts.expose ?? defaultExpose;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

