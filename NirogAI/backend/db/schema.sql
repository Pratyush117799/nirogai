-- ============================================================
-- NirogAI — PostgreSQL Schema
-- File: backend/db/schema.sql
-- Run this once to create all tables
-- ============================================================

-- Users table (auth)
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  DEFAULT 'user',   -- 'user' | 'asha_worker' | 'admin'
    created_at    TIMESTAMP    DEFAULT NOW()
);

-- Screening results table (all 3 modules store here)
CREATE TABLE IF NOT EXISTS screenings (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER     REFERENCES users(id) ON DELETE CASCADE,
    disease          VARCHAR(50) NOT NULL,        -- 'diabetes' | 'anemia' | 'skin'
    risk_level       VARCHAR(20) NOT NULL,        -- 'low' | 'medium' | 'high'
    risk_probability DECIMAL(5,1) NOT NULL,       -- e.g. 72.4
    key_factors      JSONB,                       -- array of strings
    recommendation   TEXT,
    model_confidence JSONB,                       -- {xgboost: 88.1, lgbm: 79.2, ...}
    input_data       JSONB,                       -- raw form inputs (for audit)
    threshold_type   VARCHAR(20) DEFAULT 'screening',
    disclaimer       TEXT,
    created_at       TIMESTAMP   DEFAULT NOW()
);

-- Index for fast user history lookup
CREATE INDEX IF NOT EXISTS idx_screenings_user_id ON screenings(user_id);
CREATE INDEX IF NOT EXISTS idx_screenings_disease  ON screenings(disease);
CREATE INDEX IF NOT EXISTS idx_screenings_created  ON screenings(created_at DESC);
