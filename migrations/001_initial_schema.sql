-- ============================================================================
-- Fear and Greed Telegram Bot - Initial D1 Database Schema
-- Migration: 001_initial_schema.sql
-- Description: Creates all tables, indexes, and constraints for the bot
-- ============================================================================

-- ============================================================================
-- USERS TABLE
-- Stores user subscription information
-- ============================================================================
-- chat_id: Unique Telegram chat identifier (primary key)
-- subscription_status: Whether user is subscribed (1=subscribed, 0=unsubscribed)
-- created_at: Unix timestamp when user was first added
-- updated_at: Unix timestamp when user record was last modified
CREATE TABLE IF NOT EXISTS users (
    chat_id TEXT PRIMARY KEY,
    subscription_status INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Index for filtering by subscription status
CREATE INDEX IF NOT EXISTS idx_users_subscription_status
    ON users(subscription_status);

-- ============================================================================
-- WATCHLISTS TABLE
-- Stores user watchlist entries (one row per ticker per user)
-- ============================================================================
-- id: Auto-incrementing primary key
-- chat_id: Foreign key reference to users table
-- ticker: Stock symbol (e.g., SPY, AAPL)
-- created_at: Unix timestamp when ticker was added to watchlist
CREATE TABLE IF NOT EXISTS watchlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(chat_id) REFERENCES users(chat_id) ON DELETE CASCADE,
    UNIQUE(chat_id, ticker)
);

-- Index for querying watchlists by user
CREATE INDEX IF NOT EXISTS idx_watchlists_chat_id
    ON watchlists(chat_id);

-- Index for querying watchlists by ticker
CREATE INDEX IF NOT EXISTS idx_watchlists_ticker
    ON watchlists(ticker);

-- ============================================================================
-- EXECUTIONS TABLE
-- Stores signal execution history
-- ============================================================================
-- id: Auto-incrementing primary key
-- chat_id: Foreign key reference to users table
-- signal_type: Type of signal executed (BUY or SELL)
-- ticker: Stock symbol for the execution
-- execution_price: Actual price at which signal was executed
-- signal_price: Original signal price (may differ from execution price)
-- execution_date: Unix timestamp when signal was executed
-- created_at: Unix timestamp when record was created
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

-- Index for querying executions by user
CREATE INDEX IF NOT EXISTS idx_executions_chat_id
    ON executions(chat_id);

-- Composite index for querying executions by user and ticker
CREATE INDEX IF NOT EXISTS idx_executions_chat_id_ticker
    ON executions(chat_id, ticker);

-- Index for querying executions by date (descending for recent first)
CREATE INDEX IF NOT EXISTS idx_executions_execution_date
    ON executions(execution_date DESC);

-- ============================================================================
-- ACTIVE_POSITIONS TABLE
-- Stores current open trading positions
-- ============================================================================
-- id: Auto-incrementing primary key
-- chat_id: Foreign key reference to users table
-- ticker: Stock symbol for the position
-- entry_price: Price at which position was entered
-- created_at: Unix timestamp when position was opened
-- updated_at: Unix timestamp when position was last modified
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

-- Index for querying positions by user
CREATE INDEX IF NOT EXISTS idx_active_positions_chat_id
    ON active_positions(chat_id);

-- Index for querying positions by ticker
CREATE INDEX IF NOT EXISTS idx_active_positions_ticker
    ON active_positions(ticker);

-- ============================================================================
-- CACHE TABLE
-- Stores cached data with TTL-based expiration
-- ============================================================================
-- cache_key: Unique identifier for cached item (primary key)
-- cache_value: JSON-serialized cached data
-- expires_at: Unix timestamp when cache entry expires
-- updated_at: Unix timestamp when cache entry was last updated
CREATE TABLE IF NOT EXISTS cache (
    cache_key TEXT PRIMARY KEY,
    cache_value TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Index for efficiently cleaning up expired cache entries
CREATE INDEX IF NOT EXISTS idx_cache_expires_at
    ON cache(expires_at);

-- ============================================================================
-- End of migration script
-- ============================================================================
