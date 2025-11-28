# Requirements Document

## Introduction

This specification defines the requirements for migrating the Fear and Greed Telegram Bot from Cloudflare Workers KV (key-value storage) to Cloudflare D1 (SQL database). The migration aims to improve data structure, enable complex queries, support relational data modeling, and provide better scalability for future features.

## Glossary

- **KV**: Cloudflare Workers KV, a global, low-latency key-value data store
- **D1**: Cloudflare D1, a serverless SQL database built on SQLite
- **Migration**: The process of transferring data from KV to D1 and updating application code
- **Repository**: Data access layer that abstracts storage implementation details
- **Chat ID**: Unique identifier for a Telegram user or chat
- **Ticker**: Stock symbol (e.g., SPY, AAPL)
- **Signal Execution**: Record of a user executing a BUY or SELL trading signal
- **Active Position**: Current open trading position for a user
- **Watchlist**: User-specific list of stock tickers to monitor
- **Subscription**: User's opt-in status for receiving automated alerts
- **Fear & Greed Cache**: Cached market sentiment data with TTL
- **Worker**: Cloudflare Workers serverless function

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want to design a normalized SQL schema for D1, so that data relationships are properly modeled and queries are efficient.

#### Acceptance Criteria

1. WHEN designing the database schema THEN the system SHALL create a users table with columns for chat_id (primary key), subscription_status, created_at, and updated_at
2. WHEN designing the database schema THEN the system SHALL create a watchlists table with columns for id (primary key), chat_id (foreign key), ticker, and created_at
3. WHEN designing the database schema THEN the system SHALL create an executions table with columns for id (primary key), chat_id (foreign key), signal_type, ticker, execution_price, signal_price, execution_date, and created_at
4. WHEN designing the database schema THEN the system SHALL create an active_positions table with columns for id (primary key), chat_id (foreign key), ticker, entry_price, created_at, and updated_at
5. WHEN designing the database schema THEN the system SHALL create a cache table with columns for cache_key (primary key), cache_value, expires_at, and updated_at
6. WHEN defining foreign keys THEN the system SHALL establish relationships between users.chat_id and all dependent tables
7. WHEN defining indexes THEN the system SHALL create indexes on frequently queried columns including chat_id, ticker, execution_date, and expires_at
8. WHEN defining constraints THEN the system SHALL enforce unique constraints where appropriate (e.g., one active position per user per ticker)

### Requirement 2

**User Story:** As a developer, I want to create SQL migration scripts, so that the D1 database can be initialized with the correct schema.

#### Acceptance Criteria

1. WHEN creating migration scripts THEN the system SHALL generate a SQL file that creates all required tables with proper column types
2. WHEN creating migration scripts THEN the system SHALL include CREATE INDEX statements for all required indexes
3. WHEN creating migration scripts THEN the system SHALL include foreign key constraints with appropriate ON DELETE actions
4. WHEN creating migration scripts THEN the system SHALL use IF NOT EXISTS clauses to make migrations idempotent
5. WHEN creating migration scripts THEN the system SHALL include comments documenting each table and column purpose

### Requirement 3

**User Story:** As a developer, I want to implement D1 repository classes, so that the application can interact with the SQL database using a clean abstraction layer.

#### Acceptance Criteria

1. WHEN implementing repositories THEN the system SHALL create a D1SubscriptionRepository class with methods for managing user subscriptions
2. WHEN implementing repositories THEN the system SHALL create a D1WatchlistRepository class with methods for managing user watchlists
3. WHEN implementing repositories THEN the system SHALL create a D1ExecutionRepository class with methods for managing signal executions
4. WHEN implementing repositories THEN the system SHALL create a D1PositionRepository class with methods for managing active positions
5. WHEN implementing repositories THEN the system SHALL create a D1CacheRepository class with methods for managing cached data
6. WHEN implementing repository methods THEN the system SHALL use parameterized queries to prevent SQL injection
7. WHEN implementing repository methods THEN the system SHALL handle database errors gracefully and throw appropriate custom errors
8. WHEN implementing repository methods THEN the system SHALL return TypeScript types that match existing interfaces

### Requirement 4

**User Story:** As a developer, I want to create a data migration utility, so that existing KV data can be transferred to D1 without data loss.

#### Acceptance Criteria

1. WHEN migrating subscription data THEN the system SHALL read all chat IDs from KV and insert them into the users table
2. WHEN migrating watchlist data THEN the system SHALL read all user watchlists from KV and insert them into the watchlists table
3. WHEN migrating execution history THEN the system SHALL read all execution records from KV and insert them into the executions table
4. WHEN migrating active positions THEN the system SHALL read all active positions from KV and insert them into the active_positions table
5. WHEN migrating cache data THEN the system SHALL read Fear & Greed cache from KV and insert it into the cache table
6. WHEN migration encounters errors THEN the system SHALL log detailed error information and continue processing remaining records
7. WHEN migration completes THEN the system SHALL generate a summary report showing records migrated per table
8. WHEN migration runs THEN the system SHALL support both full migration and incremental sync modes

### Requirement 5

**User Story:** As a developer, I want to implement a dual-read strategy, so that the application can read from both KV and D1 during the migration period.

#### Acceptance Criteria

1. WHEN reading subscription data THEN the system SHALL attempt to read from D1 first and fall back to KV if not found
2. WHEN reading watchlist data THEN the system SHALL attempt to read from D1 first and fall back to KV if not found
3. WHEN reading execution history THEN the system SHALL attempt to read from D1 first and fall back to KV if not found
4. WHEN reading active positions THEN the system SHALL attempt to read from D1 first and fall back to KV if not found
5. WHEN reading cache data THEN the system SHALL attempt to read from D1 first and fall back to KV if not found
6. WHEN fallback to KV occurs THEN the system SHALL log the fallback event for monitoring purposes
7. WHEN dual-read is enabled THEN the system SHALL use a feature flag to control the behavior

### Requirement 6

**User Story:** As a developer, I want to implement a dual-write strategy, so that data is written to both KV and D1 during the migration period.

#### Acceptance Criteria

1. WHEN writing subscription data THEN the system SHALL write to both D1 and KV storage
2. WHEN writing watchlist data THEN the system SHALL write to both D1 and KV storage
3. WHEN writing execution history THEN the system SHALL write to both D1 and KV storage
4. WHEN writing active positions THEN the system SHALL write to both D1 and KV storage
5. WHEN writing cache data THEN the system SHALL write to both D1 and KV storage
6. WHEN dual-write to D1 fails THEN the system SHALL log the error but still succeed if KV write succeeds
7. WHEN dual-write to KV fails THEN the system SHALL log the error but still succeed if D1 write succeeds
8. WHEN dual-write is enabled THEN the system SHALL use a feature flag to control the behavior

### Requirement 7

**User Story:** As a developer, I want to update environment configuration, so that the Worker has access to the D1 database binding.

#### Acceptance Criteria

1. WHEN configuring the Worker THEN the system SHALL update the wrangler config generation script to add D1 database binding
2. WHEN configuring the Worker THEN the system SHALL add D1 environment variables for database configuration
3. WHEN configuring the Worker THEN the system SHALL update the Env interface to include the D1 binding
4. WHEN configuring the Worker THEN the system SHALL document the D1 database name and binding name

### Requirement 8

**User Story:** As a developer, I want to update service layer code, so that services use the new repository interfaces without breaking existing functionality.

#### Acceptance Criteria

1. WHEN updating services THEN the system SHALL modify all service classes to accept both KV and D1 repositories
2. WHEN updating services THEN the system SHALL maintain existing service method signatures
3. WHEN updating services THEN the system SHALL ensure all existing tests continue to pass
4. WHEN updating services THEN the system SHALL use dependency injection to provide repository implementations

### Requirement 9

**User Story:** As a developer, I want to implement data validation, so that migrated data maintains integrity and consistency.

#### Acceptance Criteria

1. WHEN validating migrated data THEN the system SHALL verify that all KV chat IDs exist in the D1 users table
2. WHEN validating migrated data THEN the system SHALL verify that watchlist counts match between KV and D1
3. WHEN validating migrated data THEN the system SHALL verify that execution history counts match between KV and D1
4. WHEN validating migrated data THEN the system SHALL verify that active position counts match between KV and D1
5. WHEN validation fails THEN the system SHALL generate a detailed report of discrepancies
6. WHEN validation succeeds THEN the system SHALL log a success message with record counts

### Requirement 10

**User Story:** As a system administrator, I want to implement a rollback strategy, so that the system can revert to KV-only mode if issues arise.

#### Acceptance Criteria

1. WHEN rollback is triggered THEN the system SHALL disable D1 reads via feature flag
2. WHEN rollback is triggered THEN the system SHALL disable D1 writes via feature flag
3. WHEN rollback is triggered THEN the system SHALL continue operating with KV as the primary data store
4. WHEN rollback is triggered THEN the system SHALL log the rollback event with timestamp and reason
5. WHEN rollback is complete THEN the system SHALL maintain all data written to KV during the migration period

### Requirement 11

**User Story:** As a developer, I want to implement comprehensive error handling, so that database failures are handled gracefully.

#### Acceptance Criteria

1. WHEN a D1 query fails THEN the system SHALL throw a custom D1Error with context information
2. WHEN a D1 connection fails THEN the system SHALL log the error and fall back to KV if dual-read is enabled
3. WHEN a D1 transaction fails THEN the system SHALL roll back the transaction and throw an appropriate error
4. WHEN a D1 constraint violation occurs THEN the system SHALL throw a descriptive error indicating the constraint violated
5. WHEN D1 errors occur THEN the system SHALL include the original error message and stack trace in logs

### Requirement 12

**User Story:** As a developer, I want to create a cutover plan, so that the final switch from KV to D1-only mode is executed safely.

#### Acceptance Criteria

1. WHEN planning cutover THEN the system SHALL document the sequence of feature flag changes
2. WHEN planning cutover THEN the system SHALL define validation checkpoints before each phase
3. WHEN planning cutover THEN the system SHALL specify rollback procedures for each phase
4. WHEN planning cutover THEN the system SHALL identify monitoring metrics to track during cutover
5. WHEN executing cutover THEN the system SHALL disable dual-write to KV after validation period
6. WHEN executing cutover THEN the system SHALL disable KV fallback reads after validation period
7. WHEN cutover is complete THEN the system SHALL remove KV binding from Worker configuration

### Requirement 13

**User Story:** As a developer, I want to optimize D1 queries, so that database performance meets or exceeds KV performance.

#### Acceptance Criteria

1. WHEN querying user data THEN the system SHALL use indexed lookups on chat_id
2. WHEN querying execution history THEN the system SHALL use indexed lookups on chat_id and execution_date
3. WHEN querying watchlists THEN the system SHALL use indexed lookups on chat_id
4. WHEN querying active positions THEN the system SHALL use indexed lookups on chat_id and ticker
5. WHEN querying cache THEN the system SHALL use indexed lookups on cache_key and expires_at
6. WHEN performing bulk operations THEN the system SHALL use batch inserts with transactions
7. WHEN querying frequently accessed data THEN the system SHALL consider using prepared statements

### Requirement 14

**User Story:** As a developer, I want to implement database connection pooling, so that D1 connections are managed efficiently.

#### Acceptance Criteria

1. WHEN accessing D1 THEN the system SHALL reuse the database binding provided by the Worker environment
2. WHEN executing multiple queries THEN the system SHALL use transactions where appropriate to reduce round trips
3. WHEN handling concurrent requests THEN the system SHALL rely on Cloudflare's built-in connection management
4. WHEN queries complete THEN the system SHALL ensure proper cleanup of resources

### Requirement 15

**User Story:** As a developer, I want to create integration tests for D1 repositories, so that database operations are verified to work correctly.

#### Acceptance Criteria

1. WHEN testing repositories THEN the system SHALL create tests for all CRUD operations
2. WHEN testing repositories THEN the system SHALL verify foreign key constraints are enforced
3. WHEN testing repositories THEN the system SHALL verify unique constraints are enforced
4. WHEN testing repositories THEN the system SHALL test error handling for constraint violations
5. WHEN testing repositories THEN the system SHALL test transaction rollback behavior
6. WHEN testing repositories THEN the system SHALL use a test database instance separate from production
7. WHEN testing repositories THEN the system SHALL clean up test data after each test run

### Requirement 16

**User Story:** As a developer, I want to document the migration process, so that future developers understand the architecture and can maintain the system.

#### Acceptance Criteria

1. WHEN documenting migration THEN the system SHALL create a MIGRATION.md file describing the process
2. WHEN documenting migration THEN the system SHALL include schema diagrams showing table relationships
3. WHEN documenting migration THEN the system SHALL document all feature flags and their purposes
4. WHEN documenting migration THEN the system SHALL provide examples of common queries
5. WHEN documenting migration THEN the system SHALL document the rollback procedure
6. WHEN documenting migration THEN the system SHALL update the README with D1 setup instructions

### Requirement 17

**User Story:** As a system administrator, I want to clean up KV data after successful migration, so that we eliminate redundant storage costs and simplify the system.

#### Acceptance Criteria

1. WHEN deleting KV data THEN the system SHALL delete keys in order of criticality (cache first, subscriptions last)
2. WHEN deleting KV data THEN the system SHALL log each key deletion for audit purposes
3. WHEN cleanup completes THEN the system SHALL generate a report showing keys deleted and any errors
4. WHEN cleanup is requested THEN the system SHALL require admin authentication and explicit confirmation parameter
5. WHEN cleanup is requested while KV fallback is enabled THEN the system SHALL reject the request with an error message
