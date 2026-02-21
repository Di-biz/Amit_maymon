-- =====================================================
-- Tehila Bodyshop CRM - Schema alignment with plan
-- Migration: 003_schema_align.sql
-- Run after 001_init.sql
-- =====================================================

-- Cars: add first_registration_date (תאריך עלייה לכביש)
ALTER TABLE cars
  ADD COLUMN IF NOT EXISTS first_registration_date DATE;

-- Cases: add case_key, opened_at, treatment_finished_at, claim_number
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS case_key TEXT,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS treatment_finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_number TEXT;

-- Backfill opened_at from created_at for existing rows
UPDATE cases SET opened_at = created_at WHERE opened_at IS NULL;

-- Optional: unique index on case_key per branch to avoid duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_case_key_branch
  ON cases(branch_id, case_key) WHERE case_key IS NOT NULL;

-- Case workflow steps: who completed the step (for audit)
ALTER TABLE case_workflow_steps
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- CEO approvals: who decided (for audit)
ALTER TABLE ceo_approvals
  ADD COLUMN IF NOT EXISTS decided_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- =====================================================
-- RLS: CEO sees all (global visibility)
-- =====================================================

-- Cars: CEO can select all
CREATE POLICY cars_select_ceo ON cars
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO'));

-- Cases: CEO can select all
CREATE POLICY cases_select_ceo ON cases
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO'));

-- Case workflow runs: CEO can select all (via case)
CREATE POLICY case_workflow_runs_select_ceo ON case_workflow_runs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO'));

-- Case workflow steps: CEO can select all
CREATE POLICY case_workflow_steps_select_ceo ON case_workflow_steps
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO'));

-- CEO approvals: CEO can select all
CREATE POLICY ceo_approvals_select_ceo ON ceo_approvals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO'));

-- Bodywork extras: CEO can select all (via case)
CREATE POLICY bodywork_extras_select_ceo ON bodywork_extras
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO'));

-- Audit events: CEO can select all (broad read for oversight)
CREATE POLICY audit_events_select_ceo ON audit_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO'));
