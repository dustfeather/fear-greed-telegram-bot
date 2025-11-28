# Design Document

## Overview

This design document outlines the migration strategy from Cloudflare Workers KV to Cloudflare D1 SQL Database for the Fear and Greed Telegram Bot. The migration will be executed in phases to ensure data integrity throughout the process.

The migration follows a phased approach:
1. **Phase 1**: Schema design and D1 setup
2. **Phase 2**: Implement D1 repositories
3. **Phase 3**: Data migration from KV to D1
4. **Phase 4**: Data validation
5. **Phase 5**: Cutover to D1-only mode
6. **Phase 6**: Manual KV cleanup

## Architecture

### Current Architecture (KV-based)

```
┌─────────────┐
│   Worker    │
│             │
│  Services   │
│      ↓      │
│ Repositories│
│      ↓      │
│     KV      │
└─────────────┘
```

### Target Architecture (D1-based)

```
┌─────────────┐
│   Worker    │
│             │
│  Services   │
│      ↓      │
│ Repositories│
│      ↓      │
│     D1      │
└─────────────┘
```

## Components and Interfaces

### Database Schema

#### Users Table
Stores user subscription information.

```sql
CREATE TABLE IF NOT EXISTS users (
    chat_id TEXT PRIMARY KEY,
    subscription_status INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_subscription_status
    ON users(subscription_status);
```

#### Watchlists Table
Stores user watchlist entries with one row per ticker per user.

```sql
CREATE TABLE IF NOT EXISTS watchlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(chat_id) REFERENCES users(chat_id) ON DELETE CASCADE,
    UNIQUE(chat_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_watchlists_chat_id
    ON watchlists(chat_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_ticker
    ON watchlists(ticker);
```

#### Executions Table
Stores signal execution history.

```sql
CREATE TABLE IF NOT EXISTS executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    signal_type TEXT NOT NULL CHECK(signal_type IN ('BUY', 'SELL')),
    ticker TEXT NOT NULL,
    execution_price REAL NOT NULL,
    signal_price REAL,
    execution_date INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(chat_id) REFERENCES users(chat_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_executions_chat_id
    ON executions(chat_id);
CREATE INDEX IF NOT EXISTS idx_executions_chat_id_ticker
    ON executions(chat_id, ticker);
CREATE INDEX IF NOT EXISTS idx_executions_execution_date
    ON executions(execution_date DESC);
```

#### Active Positions Table
Stores current open positions.

```sql
CREATE TABLE IF NOT EXISTS active_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    entry_price REAL NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(chat_id) REFERENCES users(chat_id) ON DELETE CASCADE,
    UNIQUE(chat_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_active_positions_chat_id
    ON active_positions(chat_id);
CREATE INDEX IF NOT EXISTS idx_active_positions_ticker
    ON active_positions(ticker);
```

#### Cache Table
Stores cached data with expiration.

```sql
CREATE TABLE IF NOT EXISTS cache (
    cache_key TEXT PRIMARY KEY,
    cache_value TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cache_expires_at
    ON cache(expires_at);
```

### Repository Interfaces

#### D1SubscriptionRepository

```typescript
interface D1SubscriptionRepository {
  getChatIds(): Promise<string[]>;
  addChatId(chatId: string): Promise<boolean>;
  removeChatId(chatId: string): Promise<boolean>;
  chatIdExists(chatId: string): Promise<boolean>;
}
```

#### D1WatchlistRepository

```typescript
interface D1WatchlistRepository {
  getWatchlist(chatId: string): Promise<string[]>;
  addTicker(chatId: string, ticker: string): Promise<void>;
  removeTicker(chatId: string, ticker: string): Promise<void>;
  clearWatchlist(chatId: string): Promise<void>;
}
```

#### D1ExecutionRepository

```typescript
interface D1ExecutionRepository {
  recordExecution(
    chatId: string,
    signalType: 'BUY' | 'SELL',
    ticker: string,
    executionPrice: number,
    signalPrice?: number,
    executionDate?: number
  ): Promise<void>;

  getExecutionHistory(
    chatId: string,
    ticker?: string
  ): Promise<SignalExecution[]>;

  getLatestExecution(
    chatId: string,
    ticker?: string
  ): Promise<SignalExecution | null>;
}
```

#### D1PositionRepository

```typescript
interface D1PositionRepository {
  getActivePosition(chatId: string): Promise<ActivePosition | null>;
  setActivePosition(
    chatId: string,
    ticker: string,
    entryPrice: number
  ): Promise<void>;
  clearActivePosition(chatId: string): Promise<void>;
}
```

#### D1CacheRepository

```typescript
interface D1CacheRepository {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  cleanup(): Promise<number>; // Remove expired entries
}
```



## Data Models

### TypeScript Interfaces

The existing TypeScript interfaces will remain unchanged:

```typescript
// From src/core/types/trading.ts
interface SignalExecution {
  signalType: 'BUY' | 'SELL';
  ticker: string;
  executionPrice: number;
  executionDate: number;
  signalPrice?: number;
}

interface ActivePosition {
  ticker: string;
  entryPrice: number;
}

type Watchlist = string[];
```

### Data Mapping

#### KV to D1 Mapping

| KV Key Pattern | D1 Table | Notes |
|----------------|----------|-------|
| `chat_ids` | `users` | Array of chat IDs → rows with subscription_status=1 |
| `watchlist:{chatId}` | `watchlists` | JSON array → multiple rows |
| `execution_history:{chatId}` | `executions` | JSON array → multiple rows |
| `active_position:{chatId}` | `active_positions` | JSON object → single row |
| `fear_greed_cache` | `cache` | JSON object → single row with TTL |

##
Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Foreign key constraint enforcement
*For any* attempt to insert a record with an invalid foreign key reference (e.g., a watchlist entry for a non-existent user), the database SHALL reject the operation with a foreign key constraint error.
**Validates: Requirements 1.6**

### Property 2: Unique constraint enforcement
*For any* attempt to insert a duplicate record that violates a unique constraint (e.g., two active positions for the same user and ticker), the database SHALL reject the operation with a unique constraint error.
**Validates: Requirements 1.8**

### Property 3: Migration idempotency
*For any* migration script, running it multiple times SHALL produce the same database state as running it once, with no errors on subsequent runs.
**Validates: Requirements 2.4**

### Property 4: SQL injection prevention
*For any* user-provided input used in repository queries, the system SHALL use parameterized queries such that SQL injection attempts do not execute arbitrary SQL.
**Validates: Requirements 3.6**

### Property 5: Database error handling
*For any* database operation that fails, the system SHALL throw a custom error type (D1Error) that includes context about the operation and the underlying error.
**Validates: Requirements 3.7**

### Property 6: Subscription data migration completeness
*For any* chat ID present in KV storage, after migration that chat ID SHALL exist in the D1 users table with the correct subscription status.
**Validates: Requirements 4.1**

### Property 7: Watchlist data migration completeness
*For any* user watchlist in KV storage, after migration all tickers SHALL exist in the D1 watchlists table for that user.
**Validates: Requirements 4.2**

### Property 8: Execution history migration completeness
*For any* execution record in KV storage, after migration that execution SHALL exist in the D1 executions table with all fields preserved.
**Validates: Requirements 4.3**

### Property 9: Active position migration completeness
*For any* active position in KV storage, after migration that position SHALL exist in the D1 active_positions table with all fields preserved.
**Validates: Requirements 4.4**

### Property 10: Cache data migration completeness
*For any* cache entry in KV storage, after migration that entry SHALL exist in the D1 cache table with the correct expiration time.
**Validates: Requirements 4.5**

### Property 11: Migration error resilience
*For any* error encountered during migration of a single record, the migration SHALL log the error and continue processing remaining records without aborting.
**Validates: Requirements 4.6**

### Property 12: Service API compatibility
*For any* existing service method, after migration the method signature SHALL remain unchanged and existing tests SHALL pass.
**Validates: Requirements 8.2**

### Property 13: Chat ID migration validation
*For any* chat ID in KV storage, the validation SHALL verify that chat ID exists in D1 users table.
**Validates: Requirements 9.1**

### Property 14: Watchlist count validation
*For any* user, the validation SHALL verify that the number of watchlist entries in D1 matches the number in KV.
**Validates: Requirements 9.2**

### Property 15: Execution count validation
*For any* user, the validation SHALL verify that the number of execution records in D1 matches the number in KV.
**Validates: Requirements 9.3**

### Property 16: Active position count validation
*For any* user, the validation SHALL verify that the number of active positions in D1 matches the number in KV.
**Validates: Requirements 9.4**

### Property 17: Rollback data preservation
*For any* data written to KV during the migration period, after rollback that data SHALL remain intact and accessible.
**Validates: Requirements 10.5**

### Property 18: D1 error wrapping
*For any* D1 query failure, the system SHALL throw a D1Error that includes the operation context and original error details.
**Validates: Requirements 11.1**

### Property 19: Transaction rollback on failure
*For any* D1 transaction that encounters an error, the system SHALL roll back all changes made within that transaction.
**Validates: Requirements 11.3**

### Property 20: Constraint violation error messages
*For any* D1 constraint violation, the system SHALL throw an error that identifies which constraint was violated.
**Validates: Requirements 11.4**

### Property 21: Error logging completeness
*For any* D1 error, the system SHALL log both the error message and stack trace.
**Validates: Requirements 11.5**

### Property 22: Index usage for user queries
*For any* query filtering by chat_id, the query plan SHALL show index usage on the chat_id column.
**Validates: Requirements 13.1**

### Property 23: Index usage for execution queries
*For any* query filtering by chat_id and execution_date, the query plan SHALL show index usage on those columns.
**Validates: Requirements 13.2**

### Property 24: Index usage for watchlist queries
*For any* query filtering by chat_id on watchlists table, the query plan SHALL show index usage on the chat_id column.
**Validates: Requirements 13.3**

### Property 25: Index usage for position queries
*For any* query filtering by chat_id and ticker on active_positions table, the query plan SHALL show index usage on those columns.
**Validates: Requirements 13.4**

### Property 26: Index usage for cache queries
*For any* query filtering by cache_key or expires_at, the query plan SHALL show index usage on those columns.
**Validates: Requirements 13.5**

### Property 27: Batch operations use transactions
*For any* bulk insert or update operation, the system SHALL execute all statements within a single transaction.
**Validates: Requirements 13.6**

### Property 28: Related operations use transactions
*For any* set of related database operations (e.g., updating multiple tables for a single business operation), the system SHALL execute them within a single transaction.
**Validates: Requirements 14.2**



## Error Handling

### Error Types

```typescript
class D1Error extends Error {
  constructor(
    message: string,
    public operation: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'D1Error';
  }
}

class D1ConstraintError extends D1Error {
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

class D1TransactionError extends D1Error {
  constructor(
    message: string,
    operation: string,
    originalError?: Error
  ) {
    super(message, operation, originalError);
    this.name = 'D1TransactionError';
  }
}
```

### Error Handling Strategy

1. **Query Failures**: Wrap all D1 errors in custom error types with context
2. **Constraint Violations**: Detect and throw specific constraint errors
3. **Transaction Failures**: Ensure automatic rollback and throw transaction errors
4. **Migration Errors**: Log and continue processing remaining records

### Logging Strategy

All errors should be logged with:
- Timestamp
- Operation type
- Error message
- Stack trace
- Relevant context (chat_id, ticker, etc.)

## Testing Strategy

### Unit Testing

Unit tests will verify:
- Repository CRUD operations work correctly
- Error handling throws appropriate error types
- Feature flags control behavior correctly
- Data transformation between KV and D1 formats
- SQL query generation is correct

### Property-Based Testing

Property-based tests will verify the correctness properties defined above. We will use **fast-check** as the property-based testing library for TypeScript.

Each property-based test will:
- Run a minimum of 100 iterations
- Generate random test data appropriate for the property
- Tag the test with a comment referencing the design document property
- Use the format: `**Feature: kv-to-d1-migration, Property {number}: {property_text}**`

Example property test structure:

```typescript
import fc from 'fast-check';

/**
 * Feature: kv-to-d1-migration, Property 1: Foreign key constraint enforcement
 * For any attempt to insert a record with an invalid foreign key reference,
 * the database SHALL reject the operation with a foreign key constraint error.
 */
test('foreign key constraints are enforced', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string(), // Generate random chat_id
      fc.string(), // Generate random ticker
      async (chatId, ticker) => {
        // Attempt to insert watchlist entry without user
        await expect(
          watchlistRepo.addTicker(chatId, ticker)
        ).rejects.toThrow(D1ConstraintError);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

Integration tests will verify:
- End-to-end data flow from service to D1
- Migration script execution
- Data validation after migration
- Rollback procedures

### Migration Testing

Migration tests will verify:
- All KV data is migrated to D1
- Data integrity is maintained
- Migration is idempotent
- Error handling during migration
- Validation reports are accurate

## Data Migration Strategy

### Migration Utility Design

The data migration will be integrated into the Worker deployment process as an automatic one-time migration. On first deployment with D1 enabled, the Worker will:

1. **Detect migration need**: Check if D1 tables are empty and KV has data
2. **Read from KV**: Iterate through all KV keys and read their values
3. **Transform data**: Convert KV JSON structures to D1 table rows
4. **Write to D1**: Insert transformed data using batch operations
5. **Validate**: Compare record counts and sample data
6. **Report**: Log detailed migration results
7. **Set migration flag**: Mark migration as complete to prevent re-running

The migration will run automatically on Worker startup if:
- D1 binding is configured
- Migration has not been completed (checked via a flag in D1)
- KV data exists

This approach ensures:
- Zero manual intervention required
- Migration happens automatically on first deployment
- No separate migration script to maintain
- Idempotent - safe to redeploy without re-migrating

### Migration Module Structure

```typescript
interface MigrationResult {
  table: string;
  recordsMigrated: number;
  errors: MigrationError[];
  duration: number;
}

interface MigrationError {
  key: string;
  error: string;
  data?: any;
}

interface MigrationStatus {
  completed: boolean;
  timestamp: number;
  results: MigrationResult[];
}

class DataMigrator {
  async needsMigration(): Promise<boolean>;
  async migrateSubscriptions(): Promise<MigrationResult>;
  async migrateWatchlists(): Promise<MigrationResult>;
  async migrateExecutions(): Promise<MigrationResult>;
  async migrateActivePositions(): Promise<MigrationResult>;
  async migrateCache(): Promise<MigrationResult>;
  async validateMigration(): Promise<ValidationReport>;
  async markMigrationComplete(): Promise<void>;
  async runMigration(): Promise<MigrationStatus>;
}


```

### Migration Trigger via GitHub Actions

The migration will run automatically as part of the GitHub Actions deployment workflow:

```yaml
# .github/workflows/deploy.yml
- name: Run D1 Migration
  run: |
    # Run migration script using wrangler
    npx wrangler d1 execute FEAR_GREED_D1 --file=migrations/migrate-kv-to-d1.sql

    # Or trigger via admin endpoint after deployment
    curl -X POST https://your-worker.workers.dev/admin/migrate \
      -H "Authorization: Bearer ${{ secrets.ADMIN_TOKEN }}"
```

The migration script will:
1. Check if migration has already been completed
2. If not, read all data from KV
3. Transform and insert into D1
4. Validate the migration
5. Mark migration as complete

### Migration State Tracking

A special table tracks migration status:

```sql
CREATE TABLE IF NOT EXISTS _migration_status (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    version TEXT NOT NULL
);
```

This ensures migration only runs once, even across multiple deployments.

### Migration Execution Approach

#### Direct Migration Approach (Recommended)
- Execute migration script automatically via GitHub Actions
- Read all KV data and write to D1 in batches
- Suitable for current data volume (estimated <10,000 records)
- Execution time: ~5-10 minutes

**Process:**
1. Deploy new version with D1 support
2. Migration script runs automatically during deployment
3. Validate data consistency
4. Switch to D1-only mode
5. Clean up KV data after confirming D1 is working

### KV Key Enumeration

Since KV doesn't provide a native list operation, we'll use the following approaches:

1. **Known Keys**: For global keys like `chat_ids`, we know the exact key names
2. **User-specific Keys**: For keys like `watchlist:{chatId}`, we'll iterate through all chat IDs
3. **Pattern Matching**: Use KV list operation with prefix matching where available

```typescript
// Example: Migrate all watchlists
async function migrateWatchlists(kv: KVNamespace, db: D1Database) {
  // Get all chat IDs first
  const chatIds = await getChatIds(kv);

  const results: MigrationResult = {
    table: 'watchlists',
    recordsMigrated: 0,
    errors: [],
    duration: 0
  };

  const startTime = Date.now();

  for (const chatId of chatIds) {
    try {
      const key = watchlistKey(chatId);
      const watchlistJson = await kv.get(key);

      if (!watchlistJson) continue;

      const watchlist = JSON.parse(watchlistJson) as string[];

      // Batch insert all tickers for this user
      const statements = watchlist.map(ticker =>
        db.prepare(
          'INSERT INTO watchlists (chat_id, ticker, created_at) VALUES (?, ?, ?)'
        ).bind(chatId, ticker, Date.now())
      );

      await db.batch(statements);
      results.recordsMigrated += watchlist.length;

    } catch (error) {
      results.errors.push({
        key: watchlistKey(chatId),
        error: error.message,
        data: { chatId }
      });
    }
  }

  results.duration = Date.now() - startTime;
  return results;
}
```

### Data Transformation Examples

#### Subscriptions (chat_ids array → users table)
```typescript
// KV: ["123456", "789012", "345678"]
// D1: INSERT INTO users (chat_id, subscription_status, created_at, updated_at)
//     VALUES ('123456', 1, NOW, NOW), ('789012', 1, NOW, NOW), ...
```

#### Watchlists (JSON array → multiple rows)
```typescript
// KV: watchlist:123456 = ["SPY", "AAPL", "MSFT"]
// D1: INSERT INTO watchlists (chat_id, ticker, created_at)
//     VALUES ('123456', 'SPY', NOW), ('123456', 'AAPL', NOW), ...
```

#### Executions (JSON array → multiple rows)
```typescript
// KV: execution_history:123456 = [{signalType: "BUY", ticker: "SPY", ...}, ...]
// D1: INSERT INTO executions (chat_id, signal_type, ticker, execution_price, ...)
//     VALUES ('123456', 'BUY', 'SPY', 450.50, ...)
```

#### Active Positions (JSON object → single row)
```typescript
// KV: active_position:123456 = {ticker: "SPY", entryPrice: 450.50}
// D1: INSERT INTO active_positions (chat_id, ticker, entry_price, created_at, updated_at)
//     VALUES ('123456', 'SPY', 450.50, NOW, NOW)
```

#### Cache (JSON object → single row with TTL)
```typescript
// KV: fear_greed_cache = {data: {...}, timestamp: 1234567890}
// D1: INSERT INTO cache (cache_key, cache_value, expires_at, updated_at)
//     VALUES ('fear_greed_cache', '{"data": {...}}', TIMESTAMP + TTL, NOW)
```

### Migration Validation

After migration, the validation script will:

1. **Count Validation**: Compare record counts between KV and D1
2. **Sample Validation**: Randomly sample 10% of records and compare values
3. **Referential Integrity**: Verify all foreign keys are valid
4. **Data Type Validation**: Ensure all numeric values are within expected ranges
5. **Completeness Check**: Verify no KV keys were missed

```typescript
interface ValidationReport {
  timestamp: number;
  tables: {
    [tableName: string]: {
      kvCount: number;
      d1Count: number;
      match: boolean;
      sampleChecks: number;
      sampleFailures: string[];
    };
  };
  overallSuccess: boolean;
  discrepancies: string[];
}
```

### Migration Execution Flow

The migration runs automatically during GitHub Actions deployment:

1. **GitHub Actions Workflow** starts on push to main
2. **Build and Deploy** Worker with D1 binding
3. **Run Migration Step** executes migration script
4. **Migration Script** checks if already completed
5. **If Not Complete**: Migrate all data from KV to D1
6. **Validate** data integrity
7. **Mark Complete** to prevent re-running
8. **Deployment Continues** if migration succeeds

```bash
# Local testing - run migration manually
npx wrangler d1 execute FEAR_GREED_D1 --file=migrations/migrate-kv-to-d1.sql

# Check migration status via admin endpoint
curl https://your-worker.workers.dev/admin/migration-status
```

### Manual Migration Trigger (Optional)

For testing or manual control, an admin endpoint can trigger migration:

```typescript
// Admin endpoint to manually trigger migration
if (url.pathname === '/admin/migrate' && isAdmin(request)) {
  const migrator = new DataMigrator(env.FEAR_GREED_KV, env.FEAR_GREED_D1);
  const status = await migrator.runMigration();
  return Response.json(status);
}
```

### KV Cleanup Process

After successful migration and production testing, KV data will be manually removed:

1. Verify D1 is working correctly in production
2. Test all bot functionality
3. Manually delete KV namespace from Cloudflare dashboard
4. Remove KV binding from `generate-wrangler-config.js`
5. Remove KV environment variables

### Error Handling During Migration

- **Partial Failures**: Continue migrating other records if one fails
- **Duplicate Keys**: Use `INSERT OR IGNORE` for idempotency
- **Constraint Violations**: Log and skip invalid records
- **Transaction Batching**: Commit every 100 records to avoid timeout
- **Retry Logic**: Retry failed batches up to 3 times

### Migration Rollback

If migration fails or data is corrupted:
1. Keep KV data intact (never delete during migration)
2. Drop and recreate D1 tables
3. Re-run migration script
4. Validate again



## Migration Phases

### Phase 1: Setup (Week 1)
1. Create D1 database instance
2. Run migration scripts to create schema
3. Verify schema with PRAGMA commands
4. Update `generate-wrangler-config.js` script to add D1 binding
5. Add D1 environment variables (database ID)
6. Update Env interface in TypeScript

### Phase 2: Implementation (Week 2-3)
1. Implement D1 repository classes
2. Update service layer to use D1 repositories
3. Write unit tests
4. Implement migration script
5. Add migration status tracking table

### Phase 3: Data Migration (Week 4)
1. Test migration in development environment
2. Deploy to staging environment (migration runs automatically via GitHub Actions)
3. Validate migrated data in staging
4. Deploy to production (migration runs automatically via GitHub Actions)
5. Migration script executes automatically during deployment
6. Validation runs automatically
7. Bot switches to D1-only mode
8. Monitor for any issues

### Phase 4: Post-Migration (Week 5)
1. Monitor D1 performance and errors
2. Verify all operations work correctly
3. Test bot functionality thoroughly
4. Manually delete KV namespace from Cloudflare dashboard
5. Remove KV binding from `generate-wrangler-config.js` script
6. Remove KV environment variables
7. Update documentation

## Rollback Strategy

If issues arise during or after migration:

### Rollback Procedure
1. Keep KV data intact (never delete during migration)
2. Revert Worker deployment to previous version using KV
3. Investigate and fix issues
4. Re-run migration when ready

### Rollback Triggers
- Migration validation fails
- Critical data inconsistencies detected
- D1 performance issues
- Critical bugs discovered

## Performance Considerations

### Query Optimization
- Use indexes on all foreign keys
- Use composite indexes for multi-column queries
- Use partial indexes for filtered queries
- Run `PRAGMA optimize` after schema changes

### Batch Operations
- Use transactions for bulk inserts
- Batch size: 100-500 records per transaction
- Use prepared statements for repeated queries

### Caching Strategy
- Cache frequently accessed data in D1 cache table
- Implement TTL-based expiration
- Clean up expired cache entries periodically

### Monitoring Metrics
- Query duration (p50, p90, p99)
- Error rate
- Rows read/written
- Cache hit rate
- Fallback frequency

## Security Considerations

### SQL Injection Prevention
- Always use parameterized queries
- Never concatenate user input into SQL
- Validate input before database operations

### Access Control
- D1 binding only accessible within Worker
- No direct database access from external sources
- Use Cloudflare's built-in security features

### Data Privacy
- Maintain existing data privacy practices
- No additional PII exposure
- Audit logs for sensitive operations

## Documentation

### Files to Create/Update
1. `MIGRATION.md` - Detailed migration guide
2. `README.md` - Update with D1 setup instructions
3. `DEPLOYMENT.md` - Update deployment process
4. `TESTING.md` - Update testing procedures
5. Schema diagrams - ER diagram showing relationships

### Documentation Content
- Schema design rationale
- Migration procedure
- Rollback procedure
- Feature flag usage
- Common queries and examples
- Troubleshooting guide
- Performance tuning tips

## Dependencies

### External Libraries
- `@cloudflare/workers-types` - TypeScript types for D1
- `fast-check` - Property-based testing library

### Cloudflare Services
- Cloudflare Workers
- Cloudflare D1
- Cloudflare KV (during migration)

### Development Tools
- Wrangler CLI - Database management
- TypeScript - Type safety
- Vitest - Testing framework

## Deployment Strategy

### Development Environment
1. Create local D1 database
2. Run migrations locally
3. Test with local data
4. Verify all tests pass

### Staging Environment
1. Create staging D1 database
2. Run migrations on staging
3. Migrate staging KV data
4. Run integration tests
5. Performance testing

### Production Environment
1. Create production D1 database in Cloudflare dashboard
2. Add `FEAR_GREED_D1_DATABASE_ID` secret in GitHub
3. Merge migration PR to main branch
4. GitHub Actions automatically:
   - Builds and deploys Worker with D1 binding
   - Runs schema migrations
   - Executes data migration from KV to D1
   - Validates data integrity
   - Switches to D1-only mode
5. Monitor deployment logs
6. Verify bot is working correctly
7. Test thoroughly in production
8. Manually delete KV namespace from Cloudflare dashboard
9. Remove KV binding from config script in follow-up PR

## Success Criteria

The migration is considered successful when:
1. All data migrated from KV to D1 with 100% accuracy
2. All existing tests pass
3. No increase in error rate
4. Query performance meets or exceeds KV performance
5. Rollback capability verified
6. Documentation complete
7. Team trained on new system
