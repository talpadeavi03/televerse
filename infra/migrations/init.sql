-- TeleVerse Database Initialization
-- Run this on a fresh PostgreSQL 16 + pgvector database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- pgvector IVFFlat index will be created after schema migration
