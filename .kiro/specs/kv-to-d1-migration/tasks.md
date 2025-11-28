# Implementation Plan

## Phase 1: Database Schema and Configuration

- [x] 1. Create D1 database schema migration script
  - Create `migrations/001_initial_schema.sql` with all table definitions
  - Include users, watchlists, executions, active_positions, and cache tables
  - Add all indexes for chat_id, ticker, execution_date, expires_at, and cache_key
  - Add foreign key constraints with ON DELETE CASCADE
  - Use IF NOT EXISTS clauses for idempotency
  - Include comments documenting each table and column
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Update environment configuration for D1
  - Update `src/core/types/env.ts` to add FEAR_GREED_D1 binding to Env interface
  - Update `scripts/generate-wrangler-config.js` to add D1 database binding configuration
  - Add D1_DATABASE_ID environment variable handling
  - Update `wrangler.jsonc` template with D1 binding placeholder
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

## Phase 2: D1 Repository Implementation

- [x] 3. Implement D1 error handling utilities
  - Create `src/core/utils/d1-errors.ts` with D1Error, D1ConstraintError, and D1TransactionError classes
  - Add error wrapping functions for D1 operations
  - Include operation context and original error details in all error types
  - _Requirements: 3.7, 11.1, 11.4, 11.5_

- [ ]* 3.1 Write property test for D1 error handling
  - **Property 5: Database error handling**
  - **Validates: Requirements 3.7**

- [ ]* 3.2 Write property test for error wrapping
  - **Property 18: D1 error wrapping**
  - **Validates: Requirements 11.1**

- [ ]* 3.3 Write property test for constraint violation errors
  - **Property 20: Constraint violation error messages**
  - **Validates: Requirements 11.4**

- [ ]* 3.4 Write property test for error logging
  - **Property 21: Error logging completeness**
  - **Validates: Requirements 11.5**

- [x] 4. Implement D1SubscriptionRepository
  - Create `src/user-management/repositories/d1-subscription-repository.ts`
  - Implement getChatIds(), addChatId(), removeChatId(), chatIdExists() methods
  - Use parameterized queries for all operations
  - Handle database errors with custom D1Error types
  - Return types matching existing KV repository interfaces
  - _Requirements: 3.1, 3.6, 3.7, 3.8_

- [ ]* 4.1 Write property test for SQL injection prevention
  - **Property 4: SQL injection prevention**
  - **Validates: Requirements 3.6**

- [ ]* 4.2 Write property test for service API compatibility
  - **Property 12: Service API compatibility**
  - **Validates: Requirements 8.2**

- [x] 5. Implement D1WatchlistRepository
  - Create `src/user-management/repositories/d1-watchlist-repository.ts`
  - Implement getWatchlist(), addTicker(), removeTicker(), clearWatchlist() methods
  - Use parameterized queries for all operations
  - Handle database errors with custom D1Error types
  - Return types matching existing KV repository interfaces
  - _Requirements: 3.2, 3.6, 3.7, 3.8_

- [x] 6. Implement D1ExecutionRepository
  - Create `src/trading/repositories/d1-execution-repository.ts`
  - Implement recordExecution(), getExecutionHistory(), getLatestExecution() methods
  - Use parameterized queries for all operations
  - Handle database errors with custom D1Error types
  - Return types matching existing KV repository interfaces
  - _Requirements: 3.3, 3.6, 3.7, 3.8_

- [x] 7. Implement D1PositionRepository
  - Create `src/trading/repositories/d1-position-repository.ts`
  - Implement getActivePosition(), setActivePosition(), clearActivePosition() methods
  - Use parameterized queries for all operations
  - Handle database errors with custom D1Error types
  - Return types matching existing KV repository interfaces
  - _Requirements: 3.4, 3.6, 3.7, 3.8_

- [x] 8. Implement D1CacheRepository
  - Create `src/market-data/repositories/d1-cache-repository.ts`
  - Implement get(), set(), delete(), cleanup() methods
  - Use parameterized queries for all operations
  - Handle TTL-based expiration logic
  - Handle database errors with custom D1Error types
  - Return types matching existing KV repository interfaces
  - _Requirements: 3.5, 3.6, 3.7, 3.8_

## Phase 3: Data Migration Implementation

- [x] 9. Create migration status tracking
  - Create `migrations/002_migration_status.sql` for _migration_status table
  - Add id, completed, completed_at, and version columns
  - Ensure only one row can exist (CHECK constraint on id = 1)
  - _Requirements: 4.7_

- [x] 10. Implement data migration utility
  - Create `src/migration/data-migrator.ts` with DataMigrator class
  - Implement needsMigration() to check if migration is required
  - Implement migrateSubscriptions() to migrate chat_ids array to users table
  - Implement migrateWatchlists() to migrate watchlist:{chatId} keys to watchlists table
  - Implement migrateExecutions() to migrate execution_history:{chatId} keys to executions table
  - Implement migrateActivePositions() to migrate active_position:{chatId} keys to active_positions table
  - Implement migrateCache() to migrate fear_greed_cache to cache table
  - Use batch operations with transactions for performance
  - Log errors but continue processing remaining records
  - Generate detailed migration summary report
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 13.6, 14.2_

- [ ]* 10.1 Write property test for migration idempotency
  - **Property 3: Migration idempotency**
  - **Validates: Requirements 2.4**

- [ ]* 10.2 Write property test for subscription migration completeness
  - **Property 6: Subscription data migration completeness**
  - **Validates: Requirements 4.1**

- [ ]* 10.3 Write property test for watchlist migration completeness
  - **Property 7: Watchlist data migration completeness**
  - **Validates: Requirements 4.2**

- [ ]* 10.4 Write property test for execution migration completeness
  - **Property 8: Execution history migration completeness**
  - **Validates: Requirements 4.3**

- [ ]* 10.5 Write property test for position migration completeness
  - **Property 9: Active position migration completeness**
  - **Validates: Requirements 4.4**

- [ ]* 10.6 Write property test for cache migration completeness
  - **Property 10: Cache data migration completeness**
  - **Validates: Requirements 4.5**

- [ ]* 10.7 Write property test for migration error resilience
  - **Property 11: Migration error resilience**
  - **Validates: Requirements 4.6**

- [ ]* 10.8 Write property test for batch operations using transactions
  - **Property 27: Batch operations use transactions**
  - **Validates: Requirements 13.6**

- [ ]* 10.9 Write property test for related operations using transactions
  - **Property 28: Related operations use transactions**
  - **Validates: Requirements 14.2**

- [x] 11. Implement data validation utility
  - Create `src/migration/data-validator.ts` with validation functions
  - Implement validateChatIds() to verify all KV chat IDs exist in D1
  - Implement validateWatchlistCounts() to compare counts between KV and D1
  - Implement validateExecutionCounts() to compare counts between KV and D1
  - Implement validatePositionCounts() to compare counts between KV and D1
  - Generate detailed validation report with discrepancies
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ]* 11.1 Write property test for chat ID validation
  - **Property 13: Chat ID migration validation**
  - **Validates: Requirements 9.1**

- [ ]* 11.2 Write property test for watchlist count validation
  - **Property 14: Watchlist count validation**
  - **Validates: Requirements 9.2**

- [ ]* 11.3 Write property test for execution count validation
  - **Property 15: Execution count validation**
  - **Validates: Requirements 9.3**

- [ ]* 11.4 Write property test for position count validation
  - **Property 16: Active position count validation**
  - **Validates: Requirements 9.4**

- [x] 12. Integrate migration into Worker startup
  - Update `src/index.ts` to check for migration need on startup
  - Run migration automatically if D1 is configured and migration not completed
  - Log migration results and mark migration as complete
  - Ensure migration only runs once using _migration_status table
  - _Requirements: 4.7, 4.8_

## Phase 4: Service Layer Integration

- [x] 13. Update subscription service for D1
  - Update `src/user-management/services/subscription-service.ts` to use D1SubscriptionRepository
  - Maintain existing service method signatures
  - Use dependency injection for repository implementation
  - Ensure all existing tests continue to pass
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 14. Update watchlist service for D1
  - Update `src/user-management/services/watchlist-service.ts` to use D1WatchlistRepository
  - Maintain existing service method signatures
  - Use dependency injection for repository implementation
  - Ensure all existing tests continue to pass
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 15. Update execution service for D1
  - Update `src/trading/services/execution-service.ts` to use D1ExecutionRepository
  - Maintain existing service method signatures
  - Use dependency injection for repository implementation
  - Ensure all existing tests continue to pass
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 16. Update position service for D1
  - Update `src/trading/services/position-service.ts` to use D1PositionRepository
  - Maintain existing service method signatures
  - Use dependency injection for repository implementation
  - Ensure all existing tests continue to pass
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 17. Update market data service for D1
  - Update `src/market-data/services/fear-greed-service.ts` to use D1CacheRepository
  - Maintain existing service method signatures
  - Use dependency injection for repository implementation
  - Ensure all existing tests continue to pass
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

## Phase 5: Testing and Validation

- [x] 18. Checkpoint - Ensure all tests pass
  - Run `npm test` to verify all unit tests pass
  - Run `npm run type-check` to verify no TypeScript errors
  - Ensure all tests pass, ask the user if questions arise

- [ ]* 19. Write integration tests for D1 repositories
  - Create test files for each D1 repository
  - Test all CRUD operations
  - Test foreign key constraint enforcement
  - Test unique constraint enforcement
  - Test error handling for constraint violations
  - Test transaction rollback behavior
  - Use test database instance separate from production
  - Clean up test data after each test run
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

- [ ]* 19.1 Write property test for foreign key constraints
  - **Property 1: Foreign key constraint enforcement**
  - **Validates: Requirements 1.6**

- [ ]* 19.2 Write property test for unique constraints
  - **Property 2: Unique constraint enforcement**
  - **Validates: Requirements 1.8**

- [ ]* 19.3 Write property test for transaction rollback
  - **Property 19: Transaction rollback on failure**
  - **Validates: Requirements 11.3**

- [ ]* 20. Write property tests for query optimization
  - Test index usage for user queries (chat_id)
  - Test index usage for execution queries (chat_id, execution_date)
  - Test index usage for watchlist queries (chat_id)
  - Test index usage for position queries (chat_id, ticker)
  - Test index usage for cache queries (cache_key, expires_at)
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ]* 20.1 Write property test for user query indexes
  - **Property 22: Index usage for user queries**
  - **Validates: Requirements 13.1**

- [ ]* 20.2 Write property test for execution query indexes
  - **Property 23: Index usage for execution queries**
  - **Validates: Requirements 13.2**

- [ ]* 20.3 Write property test for watchlist query indexes
  - **Property 24: Index usage for watchlist queries**
  - **Validates: Requirements 13.3**

- [ ]* 20.4 Write property test for position query indexes
  - **Property 25: Index usage for position queries**
  - **Validates: Requirements 13.4**

- [ ]* 20.5 Write property test for cache query indexes
  - **Property 26: Index usage for cache queries**
  - **Validates: Requirements 13.5**

## Phase 6: Deployment and Documentation

- [x] 21. Update GitHub Actions workflow
  - Update `.github/workflows/deploy.yml` to run D1 migrations
  - Add step to apply schema migrations first using `wrangler d1 execute` with `migrations/001_initial_schema.sql`
  - Add step to apply migration status table using `wrangler d1 execute` with `migrations/002_migration_status.sql`
  - Deploy Worker after schema is applied (data migration runs automatically on Worker startup)
  - Add validation step to verify migration success by checking Worker logs
  - _Requirements: 4.7, 4.8_

- [x] 22. Create migration documentation
  - Create `MIGRATION.md` with detailed migration process
  - Include schema diagrams showing table relationships
  - Document rollback procedure
  - Document validation process
  - Provide examples of common D1 queries
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 23. Update project documentation
  - Update `README.md` with D1 setup instructions
  - Update `DEPLOYMENT.md` with D1 deployment steps
  - Update `TESTING.md` with D1 testing procedures
  - Add D1 environment variable documentation
  - _Requirements: 16.6_

- [x] 24. Update CHANGELOG.md
  - Add entry for KV to D1 migration
  - Document breaking changes (if any)
  - Document new environment variables required
  - Use current date (2025-11-28) for the entry

- [x] 25. Final checkpoint - Production verification
  - Verify all bot functionality works correctly with D1
  - Monitor D1 performance metrics
  - Check error rates and query performance
  - Ensure all tests pass, ask the user if questions arise

- [ ] 26. Manual KV cleanup (Post-Migration)
  - Manually delete KV namespace from Cloudflare dashboard after verifying D1 is working
  - Remove KV binding from `scripts/generate-wrangler-config.js`
  - Remove KV environment variables from configuration
  - Remove FEAR_GREED_KV from `src/core/types/env.ts`
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_
