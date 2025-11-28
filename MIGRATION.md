# KV to D1 Migration Guide

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Migration Process](#migration-process)
4. [Validation Process](#validation-process)
5. [Rollback Procedure](#rollback-procedure)
6. [Common D1 Queries](#common-d1-queries)
7. [Troubleshooting](#troubleshooting)

## Overview

This document describes the migration from Cloudflare Workers KV (key-value storage) to Cloudflare D1 (SQL database) for the Fear and Greed Telegram Bot. The migration improves data structure, enables complex queries, supports relational data modeling, and provides better scalability.

### Migration Strategy

The migration follows an **automatic one-time migration** approach:

- Migration runs automatically during GitHub Actions deployment
- Executes only once (tracked via `_migration_status` table)
- No manual intervention required
- Idempotent and safe to redeploy

### Key Benefits

- **Relational Data**: Proper foreign key relationships between users and their data
- **Complex Queries**: SQL enables filtering, sorting, and aggregation
- **Data Integrity**: Constraints enforce data consistency
- **Better Performance**: Indexed queries for faster lookups
- **Scalability**: Better suited for growing data volumes

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐
│     users       │
│─────────────────│
│ chat_id (PK)    │◄─────┐
│ subscription_   │      │
│   status        │      │
│ created_at      │      │
│ updated_at      │      │
└─────────────────┘      │
                         │
         ┌───────────────┼───────────────┬───────────────┐
         │               │               │               │
         │               │               │               │
┌────────▼────────┐ ┌────▼─────────┐ ┌─▼─────────────┐ ┌─▼──────────┐
│   watchlists    │ │  executions  │ │active_positions│ │   cache    │
│─────────────────│ │──────────────│ │────────────────│ │────────────│
│ id (PK)         │ │ id (PK)      │ │ id (PK)        │ │ cache_key  │
│ chat_id (FK)    │ │ chat_id (FK) │ │ chat_id (FK)   │ │   (PK)     │
│ ticker          │ │ signal_type  │ │ ticker         │ │ cache_value│
│ created_at      │ │ ticker       │ │ entry_price    │ │ expires_at │
│                 │ │ execution_   │ │ created_at     │ │ updated_at │
│ UNIQUE(chat_id, │ │   price      │ │ updated_at     │ │            │
│   ticker)       │ │ signal_price │ │                │ │            │
│                 │ │ execution_   │ │ UNIQUE(chat_id,│ │            │
│                 │ │   date       │ │   ticker)      │ │            │
│                 │ │ created_at   │ │                │ │            │
└─────────────────┘ └──────────────┘ └────────────────┘ └────────────┘
```

### Table Definitions

#### 1. Users Table

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

**Columns:**
- `chat_id`: Telegram chat ID (primary key)
- `subscription_status`: 1 = subscribed, 0 = unsubscribed
- `created_at`: Unix timestamp of user creation
- `updated_at`: Unix timestamp of last update

#### 2. Watchlists Table

Stores user watchlist entries (one row per ticker per user).

```sql
CREATE TABLE IF NOT EXISTS watchlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(chat_id) REFERENCES users(chat_id) ON DELETE CASCADE,
    UNIQUE(chat_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_watchlists_chat_id ON watchlists(chat_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_ticker ON watchlists(ticker);
```

**Columns:**
- `id`: Auto-incrementing primary key
- `chat_id`: Foreign key to users table
- `ticker`: Stock symbol (e.g., SPY, AAPL)
- `created_at`: Unix timestamp when ticker was added

**Constraints:**
- Foreign key with CASCADE delete (deleting user removes all watchlist entries)
- Unique constraint on (chat_id, ticker) prevents duplicates

#### 3. Executions Table

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

CREATE INDEX IF NOT EXISTS idx_executions_chat_id ON executions(chat_id);
CREATE INDEX IF NOT EXISTS idx_executions_chat_id_ticker
    ON executions(chat_id, ticker);
CREATE INDEX IF NOT EXISTS idx_executions_execution_date
    ON executions(execution_date DESC);
```

**Columns:**
- `id`: Auto-incrementing primary key
- `chat_id`: Foreign key to users table
- `signal_type`: 'BUY' or 'SELL'
- `ticker`: Stock symbol
- `execution_price`: Price at which signal was executed
- `signal_price`: Original signal price (optional)
- `execution_date`: Unix timestamp of execution
- `created_at`: Unix timestamp when record was created

#### 4. Active Positions Table

Stores current open trading positions.

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

**Columns:**
- `id`: Auto-incrementing primary key
- `chat_id`: Foreign key to users table
- `ticker`: Stock symbol
- `entry_price`: Price at which position was opened
- `created_at`: Unix timestamp when position was created
- `updated_at`: Unix timestamp of last update

**Constraints:**
- Unique constraint on (chat_id, ticker) ensures one position per user per ticker

#### 5. Cache Table

Stores cached data with TTL-based expiration.

```sql
CREATE TABLE IF NOT EXISTS cache (
    cache_key TEXT PRIMARY KEY,
    cache_value TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);
```

**Columns:**
- `cache_key`: Unique cache key (primary key)
- `cache_value`: JSON-encoded cached data
- `expires_at`: Unix timestamp when cache expires
- `updated_at`: Unix timestamp of last update

#### 6. Migration Status Table

Tracks migration completion to ensure it runs only once.

```sql
CREATE TABLE IF NOT EXISTS _migration_status (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    version TEXT NOT NULL
);
```

**Columns:**
- `id`: Always 1 (enforced by CHECK constraint)
- `completed`: 1 if migration completed, 0 otherwise
- `completed_at`: Unix timestamp when migration completed
- `version`: Migration version identifier

### Data Mapping from KV to D1

| KV Key Pattern | D1 Table | Transformation |
|----------------|----------|----------------|
| `chat_ids` (array) | `users` | Each chat ID becomes a row with subscription_status=1 |
| `watchlist:{chatId}` (JSON array) | `watchlists` | Each ticker becomes a separate row |
| `execution_history:{chatId}` (JSON array) | `executions` | Each execution becomes a separate row |
| `active_position:{chatId}` (JSON object) | `active_positions` | Single object becomes a single row |
| `fear_greed_cache` (JSON object) | `cache` | Single object becomes a single row with TTL |

## Migration Process

### Prerequisites

1. **D1 Database Created**: Create D1 database in Cloudflare dashboard
2. **GitHub Secret Configured**: Add `FEAR_GREED_D1_DATABASE_ID` to GitHub secrets
3. **Schema Applied**: Migration scripts in `migrations/` directory

### Automatic Migration Flow

The migration runs automatically during GitHub Actions deployment:

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions Workflow                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Build and Deploy Worker with D1 Binding                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Apply Schema Migrations                                  │
│     - Run migrations/001_initial_schema.sql                  │
│     - Run migrations/002_migration_status.sql                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Worker Starts - Check Migration Status                  │
│     - Query _migration_status table                          │
│     - If completed=1, skip migration                         │
│     - If completed=0 or no record, proceed                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Execute Data Migration                                   │
│     - Migrate subscriptions (chat_ids → users)               │
│     - Migrate watchlists (watchlist:* → watchlists)          │
│     - Migrate executions (execution_history:* → executions)  │
│     - Migrate positions (active_position:* → active_positions│
│     - Migrate cache (fear_greed_cache → cache)               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Validate Migration                                       │
│     - Compare record counts between KV and D1                │
│     - Verify data integrity                                  │
│     - Check foreign key relationships                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Mark Migration Complete                                  │
│     - Set completed=1 in _migration_status                   │
│     - Record completion timestamp                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Switch to D1-Only Mode                                   │
│     - All operations now use D1                              │
│     - KV remains intact for rollback if needed               │
└─────────────────────────────────────────────────────────────┘
```

### Migration Steps in Detail

#### Step 1: Migrate Subscriptions

```typescript
// Read chat_ids array from KV
const chatIdsJson = await kv.get('chat_ids');
const chatIds = JSON.parse(chatIdsJson) as string[];

// Insert into users table
const statements = chatIds.map(chatId =>
  db.prepare(
    'INSERT OR IGNORE INTO users (chat_id, subscription_status, created_at, updated_at) VALUES (?, 1, ?, ?)'
  ).bind(chatId, Date.now(), Date.now())
);

await db.batch(statements);
```

#### Step 2: Migrate Watchlists

```typescript
// For each user, read their watchlist from KV
for (const chatId of chatIds) {
  const watchlistJson = await kv.get(`watchlist:${chatId}`);
  if (!watchlistJson) continue;

  const watchlist = JSON.parse(watchlistJson) as string[];

  // Insert each ticker as a separate row
  const statements = watchlist.map(ticker =>
    db.prepare(
      'INSERT OR IGNORE INTO watchlists (chat_id, ticker, created_at) VALUES (?, ?, ?)'
    ).bind(chatId, ticker, Date.now())
  );

  await db.batch(statements);
}
```

#### Step 3: Migrate Execution History

```typescript
// For each user, read their execution history from KV
for (const chatId of chatIds) {
  const historyJson = await kv.get(`execution_history:${chatId}`);
  if (!historyJson) continue;

  const history = JSON.parse(historyJson) as SignalExecution[];

  // Insert each execution as a separate row
  const statements = history.map(exec =>
    db.prepare(
      `INSERT OR IGNORE INTO executions
       (chat_id, signal_type, ticker, execution_price, signal_price, execution_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      chatId,
      exec.signalType,
      exec.ticker,
      exec.executionPrice,
      exec.signalPrice || null,
      exec.executionDate,
      Date.now()
    )
  );

  await db.batch(statements);
}
```

#### Step 4: Migrate Active Positions

```typescript
// For each user, read their active position from KV
for (const chatId of chatIds) {
  const positionJson = await kv.get(`active_position:${chatId}`);
  if (!positionJson) continue;

  const position = JSON.parse(positionJson) as ActivePosition;

  // Insert position
  await db.prepare(
    `INSERT OR IGNORE INTO active_positions
     (chat_id, ticker, entry_price, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(
    chatId,
    position.ticker,
    position.entryPrice,
    Date.now(),
    Date.now()
  ).run();
}
```

#### Step 5: Migrate Cache

```typescript
// Read Fear & Greed cache from KV
const cacheJson = await kv.get('fear_greed_cache');
if (cacheJson) {
  const cacheData = JSON.parse(cacheJson);

  // Calculate expiration (e.g., 1 hour from now)
  const expiresAt = Date.now() + (60 * 60 * 1000);

  await db.prepare(
    `INSERT OR REPLACE INTO cache
     (cache_key, cache_value, expires_at, updated_at)
     VALUES (?, ?, ?, ?)`
  ).bind(
    'fear_greed_cache',
    JSON.stringify(cacheData),
    expiresAt,
    Date.now()
  ).run();
}
```

### Error Handling During Migration

The migration is designed to be resilient:

- **Partial Failures**: If one record fails, migration continues with remaining records
- **Duplicate Prevention**: Uses `INSERT OR IGNORE` for idempotency
- **Transaction Batching**: Commits every 100 records to avoid timeouts
- **Detailed Logging**: All errors are logged with context
- **Summary Report**: Generated at the end showing success/failure counts

Example error handling:

```typescript
const errors: MigrationError[] = [];

for (const chatId of chatIds) {
  try {
    // Migration logic here
  } catch (error) {
    errors.push({
      key: `watchlist:${chatId}`,
      error: error.message,
      data: { chatId }
    });
    // Continue with next record
  }
}

// Log summary
console.log(`Migrated ${successCount} records, ${errors.length} errors`);
```

## Validation Process

After migration completes, the system validates data integrity.

### Validation Checks

#### 1. Count Validation

Compares record counts between KV and D1:

```typescript
// Validate subscriptions
const kvChatIds = await getKVChatIds();
const d1UserCount = await db.prepare(
  'SELECT COUNT(*) as count FROM users'
).first();

if (kvChatIds.length !== d1UserCount.count) {
  console.error('User count mismatch!');
}
```

#### 2. Watchlist Validation

```typescript
// For each user, compare watchlist counts
for (const chatId of chatIds) {
  const kvWatchlist = await getKVWatchlist(chatId);
  const d1Count = await db.prepare(
    'SELECT COUNT(*) as count FROM watchlists WHERE chat_id = ?'
  ).bind(chatId).first();

  if (kvWatchlist.length !== d1Count.count) {
    console.error(`Watchlist mismatch for ${chatId}`);
  }
}
```

#### 3. Execution History Validation

```typescript
// For each user, compare execution counts
for (const chatId of chatIds) {
  const kvHistory = await getKVExecutionHistory(chatId);
  const d1Count = await db.prepare(
    'SELECT COUNT(*) as count FROM executions WHERE chat_id = ?'
  ).bind(chatId).first();

  if (kvHistory.length !== d1Count.count) {
    console.error(`Execution history mismatch for ${chatId}`);
  }
}
```

#### 4. Foreign Key Integrity

```typescript
// Verify all foreign keys are valid
const orphanedWatchlists = await db.prepare(
  `SELECT COUNT(*) as count FROM watchlists w
   WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.chat_id = w.chat_id)`
).first();

if (orphanedWatchlists.count > 0) {
  console.error('Found orphaned watchlist entries!');
}
```

### Validation Report

The validation process generates a detailed report:

```typescript
interface ValidationReport {
  timestamp: number;
  tables: {
    users: {
      kvCount: number;
      d1Count: number;
      match: boolean;
    };
    watchlists: {
      kvCount: number;
      d1Count: number;
      match: boolean;
      sampleChecks: number;
      sampleFailures: string[];
    };
    executions: {
      kvCount: number;
      d1Count: number;
      match: boolean;
    };
    active_positions: {
      kvCount: number;
      d1Count: number;
      match: boolean;
    };
  };
  overallSuccess: boolean;
  discrepancies: string[];
}
```

Example report:

```json
{
  "timestamp": 1701234567890,
  "tables": {
    "users": {
      "kvCount": 150,
      "d1Count": 150,
      "match": true
    },
    "watchlists": {
      "kvCount": 450,
      "d1Count": 450,
      "match": true,
      "sampleChecks": 45,
      "sampleFailures": []
    }
  },
  "overallSuccess": true,
  "discrepancies": []
}
```

## Rollback Procedure

If issues arise during or after migration, follow this rollback procedure.

### When to Rollback

Trigger rollback if:
- Migration validation fails
- Critical data inconsistencies detected
- D1 performance issues
- Critical bugs discovered in production

### Rollback Steps

#### 1. Immediate Rollback (Emergency)

If the system is broken and needs immediate fix:

```bash
# Revert to previous Worker deployment (KV-only version)
git revert <migration-commit-hash>
git push origin main

# GitHub Actions will automatically deploy the previous version
```

This immediately restores the bot to KV-only mode.

#### 2. Investigate Issues

```bash
# Check Worker logs
wrangler tail

# Query D1 to inspect data
wrangler d1 execute FEAR_GREED_D1 --command "SELECT COUNT(*) FROM users"

# Check migration status
wrangler d1 execute FEAR_GREED_D1 --command "SELECT * FROM _migration_status"
```

#### 3. Reset Migration Status (if needed)

If you need to re-run the migration:

```bash
# Reset migration status
wrangler d1 execute FEAR_GREED_D1 --command \
  "UPDATE _migration_status SET completed = 0, completed_at = NULL WHERE id = 1"

# Or delete all D1 data and start fresh
wrangler d1 execute FEAR_GREED_D1 --file=migrations/reset.sql
```

Create `migrations/reset.sql`:

```sql
-- WARNING: This deletes all data!
DELETE FROM watchlists;
DELETE FROM executions;
DELETE FROM active_positions;
DELETE FROM cache;
DELETE FROM users;
DELETE FROM _migration_status;
```

#### 4. Fix Issues and Re-deploy

After fixing the issues:

```bash
# Make necessary code fixes
git add .
git commit -m "fix: resolve migration issues"
git push origin main

# Migration will run again automatically
```

### Data Safety

**Important**: KV data is never deleted during migration. It remains intact as a backup until you manually clean it up after confirming D1 is working correctly.

## Common D1 Queries

### User Management

#### Get all subscribed users

```sql
SELECT chat_id, created_at
FROM users
WHERE subscription_status = 1
ORDER BY created_at DESC;
```

#### Check if user exists

```sql
SELECT EXISTS(
  SELECT 1 FROM users WHERE chat_id = ?
) as user_exists;
```

#### Add new user

```sql
INSERT INTO users (chat_id, subscription_status, created_at, updated_at)
VALUES (?, 1, ?, ?)
ON CONFLICT(chat_id) DO UPDATE SET updated_at = ?;
```

#### Remove user (cascades to all related data)

```sql
DELETE FROM users WHERE chat_id = ?;
```

### Watchlist Operations

#### Get user's watchlist

```sql
SELECT ticker, created_at
FROM watchlists
WHERE chat_id = ?
ORDER BY created_at ASC;
```

#### Add ticker to watchlist

```sql
INSERT INTO watchlists (chat_id, ticker, created_at)
VALUES (?, ?, ?)
ON CONFLICT(chat_id, ticker) DO NOTHING;
```

#### Remove ticker from watchlist

```sql
DELETE FROM watchlists
WHERE chat_id = ? AND ticker = ?;
```

#### Clear entire watchlist

```sql
DELETE FROM watchlists WHERE chat_id = ?;
```

#### Get all users watching a specific ticker

```sql
SELECT DISTINCT chat_id
FROM watchlists
WHERE ticker = ?;
```

### Execution History

#### Get user's execution history

```sql
SELECT signal_type, ticker, execution_price, signal_price, execution_date
FROM executions
WHERE chat_id = ?
ORDER BY execution_date DESC
LIMIT 50;
```

#### Get executions for specific ticker

```sql
SELECT signal_type, execution_price, signal_price, execution_date
FROM executions
WHERE chat_id = ? AND ticker = ?
ORDER BY execution_date DESC;
```

#### Record new execution

```sql
INSERT INTO executions
  (chat_id, signal_type, ticker, execution_price, signal_price, execution_date, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?);
```

#### Get latest execution for user

```sql
SELECT signal_type, ticker, execution_price, execution_date
FROM executions
WHERE chat_id = ?
ORDER BY execution_date DESC
LIMIT 1;
```

#### Get execution statistics

```sql
SELECT
  ticker,
  COUNT(*) as total_executions,
  SUM(CASE WHEN signal_type = 'BUY' THEN 1 ELSE 0 END) as buys,
  SUM(CASE WHEN signal_type = 'SELL' THEN 1 ELSE 0 END) as sells,
  AVG(execution_price) as avg_price
FROM executions
WHERE chat_id = ?
GROUP BY ticker
ORDER BY total_executions DESC;
```

### Active Positions

#### Get user's active position

```sql
SELECT ticker, entry_price, created_at
FROM active_positions
WHERE chat_id = ?;
```

#### Set active position

```sql
INSERT INTO active_positions (chat_id, ticker, entry_price, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(chat_id, ticker) DO UPDATE SET
  entry_price = excluded.entry_price,
  updated_at = excluded.updated_at;
```

#### Clear active position

```sql
DELETE FROM active_positions WHERE chat_id = ?;
```

#### Get all users with active positions

```sql
SELECT chat_id, ticker, entry_price
FROM active_positions
ORDER BY created_at DESC;
```

### Cache Operations

#### Get cached value

```sql
SELECT cache_value, expires_at
FROM cache
WHERE cache_key = ? AND expires_at > ?;
```

#### Set cache value

```sql
INSERT INTO cache (cache_key, cache_value, expires_at, updated_at)
VALUES (?, ?, ?, ?)
ON CONFLICT(cache_key) DO UPDATE SET
  cache_value = excluded.cache_value,
  expires_at = excluded.expires_at,
  updated_at = excluded.updated_at;
```

#### Clean up expired cache entries

```sql
DELETE FROM cache WHERE expires_at < ?;
```

### Analytics Queries

#### Get user activity summary

```sql
SELECT
  u.chat_id,
  u.subscription_status,
  COUNT(DISTINCT w.ticker) as watchlist_count,
  COUNT(DISTINCT e.id) as execution_count,
  COUNT(DISTINCT ap.id) as active_position_count
FROM users u
LEFT JOIN watchlists w ON u.chat_id = w.chat_id
LEFT JOIN executions e ON u.chat_id = e.chat_id
LEFT JOIN active_positions ap ON u.chat_id = ap.chat_id
GROUP BY u.chat_id, u.subscription_status
ORDER BY execution_count DESC;
```

#### Get most watched tickers

```sql
SELECT ticker, COUNT(*) as watcher_count
FROM watchlists
GROUP BY ticker
ORDER BY watcher_count DESC
LIMIT 10;
```

#### Get recent activity across all users

```sql
SELECT
  'execution' as activity_type,
  chat_id,
  ticker,
  signal_type as detail,
  execution_date as timestamp
FROM executions
UNION ALL
SELECT
  'watchlist_add' as activity_type,
  chat_id,
  ticker,
  NULL as detail,
  created_at as timestamp
FROM watchlists
ORDER BY timestamp DESC
LIMIT 50;
```

### Performance Optimization Queries

#### Analyze query performance

```sql
EXPLAIN QUERY PLAN
SELECT * FROM watchlists WHERE chat_id = ?;
```

Expected output should show index usage:
```
SEARCH watchlists USING INDEX idx_watchlists_chat_id (chat_id=?)
```

#### Check index usage

```sql
-- List all indexes
SELECT name, tbl_name, sql
FROM sqlite_master
WHERE type = 'index' AND tbl_name NOT LIKE 'sqlite_%';

-- Analyze table statistics
ANALYZE;

-- View index statistics
SELECT * FROM sqlite_stat1;
```

#### Optimize database

```sql
-- Rebuild indexes and update statistics
PRAGMA optimize;

-- Vacuum to reclaim space (use sparingly)
VACUUM;
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: Migration runs multiple times

**Symptom**: Duplicate data in D1 tables

**Cause**: Migration status not properly set

**Solution**:
```sql
-- Check migration status
SELECT * FROM _migration_status;

-- If missing, the migration will run again
-- To prevent this, manually mark as complete:
INSERT INTO _migration_status (id, completed, completed_at, version)
VALUES (1, 1, ?, 'v1.0.0')
ON CONFLICT(id) DO UPDATE SET completed = 1, completed_at = ?;
```

#### Issue: Foreign key constraint errors

**Symptom**: Cannot insert watchlist/execution/position

**Cause**: User doesn't exist in users table

**Solution**:
```typescript
// Always ensure user exists before inserting related data
await db.prepare(
  'INSERT OR IGNORE INTO users (chat_id, subscription_status, created_at, updated_at) VALUES (?, 1, ?, ?)'
).bind(chatId, Date.now(), Date.now()).run();

// Then insert related data
await db.prepare(
  'INSERT INTO watchlists (chat_id, ticker, created_at) VALUES (?, ?, ?)'
).bind(chatId, ticker, Date.now()).run();
```

#### Issue: Unique constraint violations

**Symptom**: Error when adding duplicate ticker to watchlist

**Cause**: Ticker already exists for user

**Solution**:
```sql
-- Use INSERT OR IGNORE to skip duplicates
INSERT OR IGNORE INTO watchlists (chat_id, ticker, created_at)
VALUES (?, ?, ?);

-- Or use INSERT OR REPLACE to update
INSERT OR REPLACE INTO watchlists (chat_id, ticker, created_at)
VALUES (?, ?, ?);
```

#### Issue: Query performance is slow

**Symptom**: Queries taking longer than expected

**Cause**: Missing indexes or outdated statistics

**Solution**:
```sql
-- Check if indexes exist
SELECT name FROM sqlite_master WHERE type = 'index';

-- Update statistics
ANALYZE;

-- Optimize database
PRAGMA optimize;

-- Check query plan
EXPLAIN QUERY PLAN SELECT * FROM watchlists WHERE chat_id = ?;
```

#### Issue: Data count mismatch after migration

**Symptom**: Validation shows different counts between KV and D1

**Cause**: Migration errors or incomplete migration

**Solution**:
```bash
# Check migration logs
wrangler tail

# Query both KV and D1 to compare
# KV count
wrangler kv:key list --namespace-id=<KV_ID> --prefix="watchlist:"

# D1 count
wrangler d1 execute FEAR_GREED_D1 --command "SELECT COUNT(*) FROM watchlists"

# If mismatch, reset and re-run migration
wrangler d1 execute FEAR_GREED_D1 --command \
  "UPDATE _migration_status SET completed = 0 WHERE id = 1"
```

#### Issue: Transaction timeout errors

**Symptom**: Migration fails with timeout errors

**Cause**: Too many operations in a single transaction

**Solution**:
```typescript
// Batch operations in smaller chunks
const BATCH_SIZE = 100;

for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE);
  const statements = batch.map(record =>
    db.prepare('INSERT INTO ...').bind(...)
  );
  await db.batch(statements);
}
```

#### Issue: Cache entries not expiring

**Symptom**: Old cache data still returned

**Cause**: Cleanup not running or expires_at not checked

**Solution**:
```typescript
// Always check expiration when reading
const result = await db.prepare(
  'SELECT cache_value FROM cache WHERE cache_key = ? AND expires_at > ?'
).bind(key, Date.now()).first();

// Run cleanup periodically (e.g., in scheduled handler)
await db.prepare('DELETE FROM cache WHERE expires_at < ?')
  .bind(Date.now())
  .run();
```

### Debugging Tips

#### Enable detailed logging

```typescript
// Add logging to migration process
console.log('Starting migration for table:', tableName);
console.log('Records to migrate:', records.length);

try {
  // Migration logic
  console.log('Successfully migrated:', successCount);
} catch (error) {
  console.error('Migration error:', {
    table: tableName,
    error: error.message,
    stack: error.stack
  });
}
```

#### Inspect D1 database directly

```bash
# List all tables
wrangler d1 execute FEAR_GREED_D1 --command \
  "SELECT name FROM sqlite_master WHERE type='table'"

# Get table schema
wrangler d1 execute FEAR_GREED_D1 --command \
  "SELECT sql FROM sqlite_master WHERE name='users'"

# Count records in each table
wrangler d1 execute FEAR_GREED_D1 --command \
  "SELECT 'users' as table_name, COUNT(*) as count FROM users
   UNION ALL
   SELECT 'watchlists', COUNT(*) FROM watchlists
   UNION ALL
   SELECT 'executions', COUNT(*) FROM executions
   UNION ALL
   SELECT 'active_positions', COUNT(*) FROM active_positions
   UNION ALL
   SELECT 'cache', COUNT(*) FROM cache"
```

#### Test queries locally

```bash
# Use wrangler dev to test locally
wrangler dev

# In another terminal, test queries
curl http://localhost:8787/admin/test-query
```

### Getting Help

If you encounter issues not covered here:

1. Check Worker logs: `wrangler tail`
2. Review GitHub Actions logs for deployment errors
3. Check Cloudflare dashboard for D1 metrics
4. Review the design document: `.kiro/specs/kv-to-d1-migration/design.md`
5. Review the requirements: `.kiro/specs/kv-to-d1-migration/requirements.md`

## Post-Migration Cleanup

After confirming D1 is working correctly in production (recommended: 1-2 weeks):

### 1. Manual KV Cleanup

```bash
# List all KV keys to verify what will be deleted
wrangler kv:key list --namespace-id=<KV_NAMESPACE_ID>

# Delete KV namespace from Cloudflare dashboard
# Navigate to: Workers & Pages > KV > [Your Namespace] > Delete
```

### 2. Remove KV from Configuration

Update `scripts/generate-wrangler-config.js`:

```javascript
// Remove KV binding section
// Before:
kv_namespaces = [
  { binding = "FEAR_GREED_KV", id = "${KV_NAMESPACE_ID}" }
]

// After: (remove entire kv_namespaces section)
```

### 3. Remove KV from Environment Types

Update `src/core/types/env.ts`:

```typescript
// Remove FEAR_GREED_KV from Env interface
export interface Env {
  // FEAR_GREED_KV: KVNamespace; // REMOVE THIS LINE
  FEAR_GREED_D1: D1Database;
  // ... other bindings
}
```

### 4. Remove KV Environment Variables

Remove from GitHub secrets and local `.dev.vars`:
- `KV_NAMESPACE_ID`

### 5. Update Documentation

Update README.md to remove KV setup instructions and only document D1 setup.

## Conclusion

This migration guide provides comprehensive instructions for migrating from KV to D1. The automatic migration approach ensures a smooth transition with minimal manual intervention. Always test thoroughly in development and staging before deploying to production, and keep KV data intact until you're confident D1 is working correctly.

For questions or issues, refer to the troubleshooting section or review the design and requirements documents in `.kiro/specs/kv-to-d1-migration/`.
