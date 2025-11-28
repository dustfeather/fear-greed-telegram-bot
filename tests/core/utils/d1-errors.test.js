/**
 * D1 Error Handling Property Tests
 */

import { TestRunner } from '../../utils/test-helpers.js';
import assert from 'node:assert';
import fc from 'fast-check';
import { D1Error, D1ConstraintError, D1TransactionError, wrapD1Error } from '../../../src/core/utils/d1-errors.js';

const runner = new TestRunner();

/**
 * **Feature: kv-to-d1-migration, Property 5: Database error handling**
 * **Validates: Requirements 3.7**
 *
 * All D1 operations should properly wrap and handle database errors with appropriate
 * error types and context information.
 */
runner.test('Property 5: Database error handling', () => {
  const result = fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 100 }).filter(s => /[a-zA-Z0-9]/.test(s)),
      fc.string({ minLength: 1, maxLength: 200 }).filter(s => /[a-zA-Z0-9]/.test(s)),
      (operation, errorMessage) => {
        const originalError = new Error(errorMessage);
        const wrappedError = wrapD1Error(operation, originalError);

        // Should be instance of D1Error
        assert(wrappedError instanceof D1Error, 'Wrapped error should be instance of D1Error');

        // Should preserve operation context
        assert(wrappedError.operation === operation, 'Should preserve operation context');

        // Should include operation in message
        assert(wrappedError.message.includes(operation), 'Should include operation in message');

        // Should have originalError property
        assert(wrappedError.originalError === originalError, 'Should have originalError property pointing to original error');

        return true;
      }
    ),
    { numRuns: 100 }
  );

  assert(result === null || result === undefined, 'Property should hold for all test cases');
});

/**
 * **Feature: kv-to-d1-migration, Property 18: D1 error wrapping**
 * **Validates: Requirements 11.1**
 *
 * D1 errors should be properly wrapped with context and original error information
 * to facilitate debugging and error handling.
 */
runner.test('Property 18: D1 error wrapping', () => {
  const result = fc.assert(
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
        assert(wrappedError.originalError === originalError, 'Should maintain error chain');

        // Should include operation in message or property
        assert(
          wrappedError.message.includes(operation) || wrappedError.operation === operation,
          'Should include operation context'
        );

        // Should be catchable as Error
        assert(wrappedError instanceof Error, 'Should be catchable as Error');

        // Should be identifiable as D1Error
        assert(wrappedError instanceof D1Error, 'Should be identifiable as D1Error');

        return true;
      }
    ),
    { numRuns: 100 }
  );

  assert(result === null || result === undefined, 'Property should hold for all test cases');
});

/**
 * **Feature: kv-to-d1-migration, Property 20: Constraint violation error messages**
 * **Validates: Requirements 11.4**
 *
 * Constraint violation errors should provide clear, actionable error messages
 * that identify the constraint type and affected data.
 */
runner.test('Property 20: Constraint violation error messages', () => {
  const result = fc.assert(
    fc.property(
      fc.constantFrom('UNIQUE', 'FOREIGN KEY', 'NOT NULL', 'CHECK'),
      fc.string({ minLength: 1, maxLength: 50 }).filter(s => /[a-zA-Z0-9]/.test(s)),
      fc.string({ minLength: 1, maxLength: 100 }).filter(s => /[a-zA-Z0-9]/.test(s)),
      (constraintType, tableName, columnName) => {
        const errorMessage = `${constraintType} constraint failed: ${tableName}.${columnName}`;
        const originalError = new Error(errorMessage);
        const constraintError = new D1ConstraintError(errorMessage, 'INSERT', constraintType, originalError);

        // Should identify constraint type
        assert(
          constraintError.constraint === constraintType,
          'Should identify constraint type'
        );

        // Should include table and column information in message or originalError
        assert(
          constraintError.message.includes(tableName) || constraintError.originalError?.message.includes(tableName),
          'Should include table information'
        );

        assert(
          constraintError.message.includes(columnName) || constraintError.originalError?.message.includes(columnName),
          'Should include column information'
        );

        // Should be catchable as D1Error
        assert(constraintError instanceof D1Error, 'Should be catchable as D1Error');

        // Should be identifiable as D1ConstraintError
        assert(constraintError instanceof D1ConstraintError, 'Should be identifiable as D1ConstraintError');

        return true;
      }
    ),
    { numRuns: 100 }
  );

  assert(result === null || result === undefined, 'Property should hold for all test cases');
});

/**
 * **Feature: kv-to-d1-migration, Property 21: Error logging completeness**
 * **Validates: Requirements 11.5**
 *
 * All error types should include sufficient information for logging and debugging,
 * including operation context, error type, and original error details.
 */
runner.test('Property 21: Error logging completeness', () => {
  const result = fc.assert(
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
        assert(error.operation, 'Should have operation property');

        // Should have message
        assert(error.message && error.message.length > 0, 'Should have message');

        // Should have stack trace
        assert(error.stack && error.stack.length > 0, 'Should have stack trace');

        // Should be serializable for logging
        const serialized = JSON.stringify({
          name: error.name,
          message: error.message,
          operation: error.operation,
          originalError: error.originalError?.message
        });
        assert(serialized.length > 0, 'Should be serializable for logging');

        return true;
      }
    ),
    { numRuns: 100 }
  );

  assert(result === null || result === undefined, 'Property should hold for all test cases');
});

// Run tests
runner.run().catch(console.error);
