---
inclusion: always
---

# Testing Guidelines

## Critical Rules

- DO NOT create tests unless explicitly requested by the user
- Use custom `TestRunner` from `tests/utils/test-helpers.js`, NOT Jest or Mocha
- All test files use `.test.js` extension and are executed with `tsx`
- Always import mocks from `test-helpers.js` - never create custom mocks
- Use Node.js built-in `assert` module for assertions

## Test File Organization

```
tests/
├── <module>/
│   ├── <submodule>/<file>.test.js          # Unit tests
│   └── <file>.property.test.js             # Property-based tests
├── integration/<file>.test.js              # Integration tests
└── utils/test-helpers.js                   # Shared utilities
```

## Running Tests

- All tests: `npm test` or `npm run test:unit`
- Single test: `npx tsx tests/path/to/test.js`
- Type check: `npm run type-check`

## Required Test Structure

Every test file must follow this pattern:

```javascript
import { TestRunner, createMockEnv } from '../utils/test-helpers.js';

const runner = new TestRunner();

runner.test('Test description', async () => {
  // Test implementation
});

runner.run().catch(console.error);
```

## Mock Environment Setup

Always use `createMockEnv()` for Cloudflare Worker testing:

```javascript
const env = createMockEnv();
// Provides: env.FEAR_GREED_D1, env.FEAR_GREED_CACHE, env.TELEGRAM_BOT_TOKEN, etc.
```

### Mock Fetch Configuration

Configure by hostname for cleaner tests:

```javascript
const mockFetch = createMockFetch({
  'api.telegram.org': () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, result: { message_id: 123 } })
  })
});
global.fetch = mockFetch;
```

### Mock D1 Database

The mock D1 supports all standard operations:
- Tables: `users`, `watchlists`, `executions`, `active_positions`, `cache`
- Methods: `.prepare().bind().run()`, `.first()`, `.all()`, `.batch()`
- Test helpers: `._clear()`, `._getUsers()`, `._getWatchlists()`

**Important**: Mock D1 state persists across tests. Clear when needed:

```javascript
env.FEAR_GREED_D1._clear();
```

## Assertion Helpers

Use these instead of raw assert:

- `assertSuccess(result)` - Verify `result.success === true`
- `assertFailure(result)` - Verify `result.success === false`
- `assertEqual(actual, expected, message)`
- `assertIncludes(array, item, message)`
- `assertNotIncludes(array, item, message)`
- `assertThrows(fn, message)`

## Property-Based Testing

Use `fast-check` for testing invariants across generated inputs:

```javascript
import fc from 'fast-check';

runner.test('Property: Description', async () => {
  const result = await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 999999999 }),
      async (input) => {
        // Test property holds for all inputs
        return true;
      }
    ),
    { numRuns: 50 }
  );
  assert(result === null || result === undefined, 'Property should hold');
});
```

Document with feature references:

```javascript
/**
 * **Feature: feature-name, Property N: Description**
 * **Validates: Requirements X.Y**
 */
```

## Security Testing Requirements

Always test SQL injection prevention with malicious inputs:

```javascript
fc.oneof(
  fc.constant("'; DROP TABLE users; --"),
  fc.constant("1 OR 1=1"),
  fc.constant("admin'--")
)
```

## Integration Test Pattern

Test complete Telegram webhook flows:

```javascript
runner.test('Complete flow: command -> action -> verification', async () => {
  const env = createMockEnv();
  const update = createTelegramUpdate('/command', 123456789);

  const request = new Request('http://localhost:8787', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET
    },
    body: JSON.stringify(update)
  });

  await index.fetch(request, env, { waitUntil: () => {} });

  // Verify state changes in D1
  const result = await env.FEAR_GREED_D1.prepare('SELECT * FROM table').all();
  assertEqual(result.results.length, 1);
});
```

## Date Mocking

For time-dependent tests, mock Date globally:

```javascript
const originalDate = Date;
global.Date = class extends originalDate {
  constructor(...args) {
    return args.length === 0
      ? new originalDate(originalDate.UTC(2024, 2, 5))
      : new originalDate(...args);
  }
  static now() {
    return new originalDate(originalDate.UTC(2024, 2, 5)).getTime();
  }
};

// Test code

global.Date = originalDate; // Always restore
```

## Test Coverage Priorities

Focus testing on:
1. SQL injection prevention (parameterized queries)
2. Foreign key and unique constraint enforcement
3. Transaction atomicity and rollback behavior
4. KV to D1 repository API compatibility
5. Data migration completeness and idempotency
6. Error resilience and graceful degradation
7. Complete user flows and state transitions
