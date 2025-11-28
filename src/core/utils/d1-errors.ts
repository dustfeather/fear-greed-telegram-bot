/**
 * D1 database error handling utilities
 */

/**
 * Base error class for D1 database operations
 */
export class D1Error extends Error {
  constructor(
    message: string,
    public operation: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'D1Error';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, D1Error);
    }
  }
}

/**
 * Error class for D1 constraint violations
 */
export class D1ConstraintError extends D1Error {
  constructor(
    message: string,
    operation: string,
    public constraint: string,
    originalError?: Error
  ) {
    super(message, operation, originalError);
    this.name = 'D1ConstraintError';
  }
}

/**
 * Error class for D1 transaction failures
 */
export class D1TransactionError extends D1Error {
  constructor(
    message: string,
    operation: string,
    originalError?: Error
  ) {
    super(message, operation, originalError);
    this.name = 'D1TransactionError';
  }
}

/**
 * Wrap a D1 error with context information
 * @param operation - Description of the operation that failed
 * @param error - The original error
 * @returns Wrapped D1Error with context
 */
export function wrapD1Error(operation: string, error: unknown): D1Error {
  const originalError = error instanceof Error ? error : new Error(String(error));
  const message = `D1 operation failed: ${operation}`;

  // Check if it's a constraint violation
  const errorMessage = originalError.message.toLowerCase();
  if (errorMessage.includes('constraint') || errorMessage.includes('unique') || errorMessage.includes('foreign key')) {
    let constraint = 'unknown';

    if (errorMessage.includes('unique')) {
      constraint = 'UNIQUE';
    } else if (errorMessage.includes('foreign key')) {
      constraint = 'FOREIGN_KEY';
    } else if (errorMessage.includes('check')) {
      constraint = 'CHECK';
    }

    return new D1ConstraintError(message, operation, constraint, originalError);
  }

  return new D1Error(message, operation, originalError);
}

/**
 * Log a D1 error with full context
 * @param error - The D1Error to log
 */
export function logD1Error(error: D1Error): void {
  console.error(`[${error.name}] ${error.message}`);
  console.error(`Operation: ${error.operation}`);

  if (error instanceof D1ConstraintError) {
    console.error(`Constraint violated: ${error.constraint}`);
  }

  if (error.originalError) {
    console.error('Original error:', error.originalError.message);
    console.error('Stack trace:', error.originalError.stack);
  }
}
