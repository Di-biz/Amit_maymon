-- =====================================================
-- Tehila Bodyshop CRM - Verification plan gaps
-- Migration: 005_verification_gaps.sql
-- Run after 003_schema_align.sql
-- =====================================================

-- 1. profiles.is_active (for disabling users)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. cases.created_by (audit: who opened the case)
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. notifications.type (for filtering by category)
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS type TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(user_id, type);

-- 4. case_workflow_steps.activated_at (when step became ACTIVE, for SLA/reports)
ALTER TABLE case_workflow_steps
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
