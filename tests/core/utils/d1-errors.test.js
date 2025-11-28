/**
 * D1 Error Handling Property Tests
 */

import fc from 'fast-check';
import { D1Error, D1ConstraintError, D1TransactionError, wrapD1Error } from '../../../src/core/utils/d1-errors.js';

describe('D1 Error Handling', () => {
  /**
   * **Feature: kv-to-d1-migration, Property 5: Database error handling**
   * **Validates: Requirements 3.7**
   *
   * All D1 operations should properly wrap and handle database errors with appropriate
   * error types and context information.
   */
  test('Property 5: Database error handling', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => /[a-zA-Z0-9]/.test(s)),
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => /[a-zA-Z0-9]/.test(s)),
        (operation, errorMessage) => {
          const originalError = new Error(errorMessage);
          const wrappedError = wrapD1Error(operation, originalError);

          // Should be instance of D1Error
          expect(wrappedError).toBeInstanceOf(D1Error);

          // Should preserve operation context
          expect(wrappedError.operation).toBe(operation);

          // Should include operation in message
          expect(wrappedError.message).toContain(operation);

          // Should have originalError property
          expect(wrappedError.originalError).toBe(originalError);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: kv-to-d1-migration, Property 18: D1 error wrapping**
   * **Validates: Requirements 11.1**
   *
   * D1 errors should be properly wrapped with context and original error information
   * to facilitate debugging and error handling.
   */
  test('Property 18: D1 error wrapping', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRANSACTION'),
        fc.string({ minLength: 5, maxLength: 100 }).filter(s => /[a-zA-Z0-9]{5,}/.test(s)),
        fc.oneof(
          fc.constant('UNIQUE constraint failed'),
          fc.constant('FOREIGN KEY constraint failed'),
          fc.constant('NOT NULL constraint failed'),
          fc.constant('Database locked'),
          fc.constant('Connection error')
        ),
        (operation, context, errorType) => {
          const originalError = new Error(`${errorType}: ${context}`);
          const wrappedError = wrapD1Error(operation, originalError);

          // Should maintain error chain via originalError property
          expect(wrappedError.originalError).toBe(originalError);

          // Should include operation in message or property
          expect(
            wrappedError.message.includes(operation) || wrappedError.operation === operation
          ).toBe(true);

          // Should be catchable as Error
          expect(wrappedError).toBeInstanceOf(Error);

          // Should be identifiable as D1Error
          expect(wrappedError).toBeInstanceOf(D1Error);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: kv-to-d1-migration, Property 20: Constraint violation error messages**
   * **Validates: Requirements 11.4**
   *
   * Constraint violation errors should provide clear, actionable error messages
   * that identify the constraint type and affected data.
   */
  test('Property 20: Constraint violation error messages', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('UNIQUE', 'FOREIGN KEY', 'NOT NULL', 'CHECK'),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => /[a-zA-Z0-9]/.test(s)),
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => /[a-zA-Z0-9]/.test(s)),
        (constraintType, tableName, columnName) => {
          const errorMessage = `${constraintType} constraint failed: ${tableName}.${columnName}`;
          const originalError = new Error(errorMessage);
          const constraintError = new D1ConstraintError(errorMessage, 'INSERT', constraintType, originalError);

          // Should identify constraint type
          expect(constraintError.constraint).toBe(constraintType);

          // Should include table and column information in message or originalError
          expect(
            constraintError.message.includes(tableName) || constraintError.originalError?.message.includes(tableName)
          ).toBe(true);

          expect(
            constraintError.message.includes(columnName) || constraintError.originalError?.message.includes(columnName)
          ).toBe(true);

          // Should be catchable as D1Error
          expect(constraintError).toBeInstanceOf(D1Error);

          // Should be identifiable as D1ConstraintError
          expect(constraintError).toBeInstanceOf(D1ConstraintError);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: kv-to-d1-migration, Property 21: Error logging completeness**
   * **Validates: Requirements 11.5**
   *
   * All error types should include sufficient information for logging and debugging,
   * including operation context, error type, and original error details.
   */
  test('Property 21: Error logging completeness', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(D1Error, D1ConstraintError, D1TransactionError),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        (ErrorClass, operation, errorMessage) => {
          const originalError = new Error(errorMessage);
          let error;

          if (ErrorClass === D1ConstraintError) {
            error = new ErrorClass(errorMessage, operation, 'UNIQUE', originalError);
          } else if (ErrorClass === D1TransactionError) {
            error = new ErrorClass(errorMessage, operation, originalError);
          } else {
            error = new ErrorClass(errorMessage, operation, originalError);
          }

          // Should have operation property
          expect(error.operation).toBeTruthy();

          // Should have message
          expect(error.message).toBeTruthy();
          expect(error.message.length).toBeGreaterThan(0);

          // Should have stack trace
          expect(error.stack).toBeTruthy();
          expect(error.stack.length).toBeGreaterThan(0);

          // Should be serializable for logging
          const serialized = JSON.stringify({
            name: error.name,
            message: error.message,
            operation: error.operation,
            originalError: error.originalError?.message
          });
          expect(serialized.length).toBeGreaterThan(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
