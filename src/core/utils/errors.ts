/**
 * Standardized error handling utilities
 */

/**
 * Application error types
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  API = 'API',
  KV = 'KV',
  TELEGRAM = 'TELEGRAM',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Standardized application error
 */
export class AppError extends Error {
  constructor(
    public readonly type: ErrorType,
    message: string,
    public readonly cause?: unknown,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'AppError';
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Create a network error
 */
export function createNetworkError(message: string, cause?: unknown): AppError {
  return new AppError(ErrorType.NETWORK, message, cause, 503);
}

/**
 * Create a validation error
 */
export function createValidationError(message: string, cause?: unknown): AppError {
  return new AppError(ErrorType.VALIDATION, message, cause, 400);
}

/**
 * Create an API error
 */
export function createApiError(message: string, cause?: unknown, statusCode?: number): AppError {
  return new AppError(ErrorType.API, message, cause, statusCode || 500);
}

/**
 * Create a KV error
 */
export function createKVError(message: string, cause?: unknown): AppError {
  return new AppError(ErrorType.KV, message, cause, 500);
}

/**
 * Create a Telegram API error
 */
export function createTelegramError(message: string, cause?: unknown, statusCode?: number): AppError {
  return new AppError(ErrorType.TELEGRAM, message, cause, statusCode);
}

/**
 * Convert an unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new AppError(ErrorType.UNKNOWN, error.message, error);
  }
  
  return new AppError(ErrorType.UNKNOWN, String(error), error);
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError || error instanceof Error) {
    return error.message;
  }
  return String(error);
}

