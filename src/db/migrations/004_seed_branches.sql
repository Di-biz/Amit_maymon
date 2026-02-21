-- =====================================================
-- Tehila Bodyshop CRM - Seed branches
-- Migration: 004_seed_branches.sql
-- Run after 001_init.sql (and 003 if used)
-- =====================================================

INSERT INTO branches (name)
SELECT name FROM (VALUES ('NETIVOT'), ('ASHKELON')) AS t(name)
WHERE NOT EXISTS (SELECT 1 FROM branches b WHERE b.name = t.name);
