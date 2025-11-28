-- ============================================================================
-- Fear and Greed Telegram Bot - Migration Status Tracking
-- Migration: 002_migration_status.sql
-- Description: Creates table to track KV to D1 migration status
-- ============================================================================

-- ============================================================================
-- MIGRATION_STATUS TABLE
-- Tracks whether the KV to D1 migration has been completed
-- ============================================================================
-- id: Always 1 (enforced by CHECK constraint to ensure single row)
-- completed: Whether migration is complete (0=not complete, 1=complete)
-- completed_at: Unix timestamp when migration was completed
-- version: Migration version identifier
CREATE TABLE IF NOT EXISTS _migration_status (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    version TEXT NOT NULL
);

-- Insert initial row if not exists
INSERT OR IGNORE INTO _migration_status (id, completed, version)
VALUES (1, 0, '1.0.0');

-- ============================================================================
-- End of migration script
-- ============================================================================
