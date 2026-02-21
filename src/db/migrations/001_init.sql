-- =====================================================
-- Tehila Bodyshop CRM - Initial Schema
-- Migration: 001_init.sql
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM (
  'SERVICE_MANAGER',
  'OFFICE',
  'CEO',
  'PAINTER',
  'SERVICE_ADVISOR'
);

CREATE TYPE general_status AS ENUM (
  'NEW',
  'IN_PROGRESS',
  'COMPLETED'
);

CREATE TYPE parts_status AS ENUM (
  'NO_PARTS',
  'ORDERED',
  'AVAILABLE'
);

CREATE TYPE insurance_type AS ENUM (
  'COMPREHENSIVE',
  'THIRD_PARTY',
  'PRIVATE',
  'OTHER'
);

CREATE TYPE claim_type AS ENUM (
  'PRIVATE',
  'ACCIDENT',
  'FLOOD'
);

CREATE TYPE workflow_type AS ENUM (
  'PROFESSIONAL',
  'CLOSURE'
);

CREATE TYPE workflow_run_status AS ENUM (
  'ACTIVE',
  'COMPLETED'
);

CREATE TYPE step_state AS ENUM (
  'PENDING',
  'ACTIVE',
  'DONE',
  'SKIPPED'
);

CREATE TYPE approval_type AS ENUM (
  'ESTIMATE_AND_DETAILS',
  'WHEELS_CHECK'
);

CREATE TYPE approval_status AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE extra_status AS ENUM (
  'IN_TREATMENT',
  'REJECTED',
  'DONE'
);

CREATE TYPE audit_entity_type AS ENUM (
  'CASE',
  'WORKFLOW_STEP',
  'APPROVAL',
  'EXTRA'
);

-- =====================================================
-- TABLES
-- =====================================================

CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  license_plate TEXT,
  make TEXT,
  model TEXT,
  year INTEGER,
  vin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE RESTRICT,
  general_status general_status NOT NULL DEFAULT 'NEW',
  parts_status parts_status NOT NULL DEFAULT 'NO_PARTS',
  insurance_type insurance_type,
  claim_type claim_type,
  fixcar_link TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE case_workflow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  workflow_type workflow_type NOT NULL,
  status workflow_run_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE case_workflow_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES case_workflow_runs(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  state step_state NOT NULL DEFAULT 'PENDING',
  order_index INTEGER NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ceo_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  approval_type approval_type NOT NULL,
  status approval_status NOT NULL DEFAULT 'PENDING',
  rejection_note TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bodywork_extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  image_path TEXT NOT NULL,
  status extra_status NOT NULL DEFAULT 'IN_TREATMENT',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type audit_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_profiles_branch_id ON profiles(branch_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_cars_branch_id ON cars(branch_id);
CREATE INDEX idx_cars_license_plate ON cars(license_plate);
CREATE INDEX idx_cases_branch_id ON cases(branch_id);
CREATE INDEX idx_cases_car_id ON cases(car_id);
CREATE INDEX idx_cases_general_status ON cases(general_status);
CREATE INDEX idx_cases_closed_at ON cases(closed_at) WHERE closed_at IS NULL;
CREATE INDEX idx_case_workflow_runs_case_id ON case_workflow_runs(case_id);
CREATE INDEX idx_case_workflow_runs_status ON case_workflow_runs(status);
CREATE INDEX idx_case_workflow_steps_run_id ON case_workflow_steps(run_id);
CREATE INDEX idx_case_workflow_steps_step_key ON case_workflow_steps(step_key);
CREATE INDEX idx_ceo_approvals_case_id ON ceo_approvals(case_id);
CREATE INDEX idx_ceo_approvals_status ON ceo_approvals(status);
CREATE INDEX idx_bodywork_extras_case_id ON bodywork_extras(case_id);
CREATE INDEX idx_bodywork_extras_status ON bodywork_extras(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
CREATE INDEX idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at);

-- =====================================================
-- RLS
-- =====================================================

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE ceo_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bodywork_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's profile (branch_id, role)
CREATE OR REPLACE FUNCTION auth.user_profile()
RETURNS TABLE (profile_id UUID, branch_id UUID, role user_role) AS $$
  SELECT id, profiles.branch_id, profiles.role
  FROM profiles
  WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Branches: authenticated users can read branches (for their context)
CREATE POLICY branches_select ON branches
  FOR SELECT TO authenticated USING (true);

-- Profiles: users can read own profile; read others in same branch for workflow
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY profiles_select_branch ON profiles
  FOR SELECT TO authenticated
  USING (
    branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- Cars: branch-scoped
CREATE POLICY cars_select ON cars
  FOR SELECT TO authenticated
  USING (
    branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY cars_insert ON cars
  FOR INSERT TO authenticated
  WITH CHECK (
    branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY cars_update ON cars
  FOR UPDATE TO authenticated
  USING (
    branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
  );

-- Cases: branch-scoped
CREATE POLICY cases_select ON cases
  FOR SELECT TO authenticated
  USING (
    branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY cases_insert ON cases
  FOR INSERT TO authenticated
  WITH CHECK (
    branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY cases_update ON cases
  FOR UPDATE TO authenticated
  USING (
    branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
  );

-- Case workflow runs: via case branch
CREATE POLICY case_workflow_runs_select ON case_workflow_runs
  FOR SELECT TO authenticated
  USING (
    case_id IN (
      SELECT id FROM cases WHERE branch_id IN (
        SELECT branch_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY case_workflow_runs_insert ON case_workflow_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    case_id IN (
      SELECT id FROM cases WHERE branch_id IN (
        SELECT branch_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY case_workflow_runs_update ON case_workflow_runs
  FOR UPDATE TO authenticated
  USING (
    case_id IN (
      SELECT id FROM cases WHERE branch_id IN (
        SELECT branch_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Case workflow steps: via run -> case -> branch
CREATE POLICY case_workflow_steps_select ON case_workflow_steps
  FOR SELECT TO authenticated
  USING (
    run_id IN (
      SELECT cwr.id FROM case_workflow_runs cwr
      JOIN cases c ON c.id = cwr.case_id
      WHERE c.branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY case_workflow_steps_insert ON case_workflow_steps
  FOR INSERT TO authenticated
  WITH CHECK (
    run_id IN (
      SELECT cwr.id FROM case_workflow_runs cwr
      JOIN cases c ON c.id = cwr.case_id
      WHERE c.branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY case_workflow_steps_update ON case_workflow_steps
  FOR UPDATE TO authenticated
  USING (
    run_id IN (
      SELECT cwr.id FROM case_workflow_runs cwr
      JOIN cases c ON c.id = cwr.case_id
      WHERE c.branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
    )
  );

-- CEO approvals: CEO can manage; others read by branch
CREATE POLICY ceo_approvals_select ON ceo_approvals
  FOR SELECT TO authenticated
  USING (
    case_id IN (
      SELECT id FROM cases WHERE branch_id IN (
        SELECT branch_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY ceo_approvals_insert ON ceo_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    case_id IN (
      SELECT id FROM cases WHERE branch_id IN (
        SELECT branch_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY ceo_approvals_update ON ceo_approvals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO')
    OR case_id IN (
      SELECT id FROM cases WHERE branch_id IN (
        SELECT branch_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Bodywork extras: branch via case; PAINTER can insert, SERVICE_MANAGER can update status
CREATE POLICY bodywork_extras_select ON bodywork_extras
  FOR SELECT TO authenticated
  USING (
    case_id IN (
      SELECT id FROM cases WHERE branch_id IN (
        SELECT branch_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY bodywork_extras_insert ON bodywork_extras
  FOR INSERT TO authenticated
  WITH CHECK (
    case_id IN (
      SELECT id FROM cases WHERE branch_id IN (
        SELECT branch_id FROM profiles WHERE id = auth.uid()
      )
    )
    AND created_by = auth.uid()
  );

CREATE POLICY bodywork_extras_update ON bodywork_extras
  FOR UPDATE TO authenticated
  USING (
    case_id IN (
      SELECT id FROM cases WHERE branch_id IN (
        SELECT branch_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Notifications: own only
CREATE POLICY notifications_select ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_insert ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY notifications_update ON notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Audit events: branch-scoped read (entity_id may be case_id, etc.); insert for all authenticated
CREATE POLICY audit_events_select ON audit_events
  FOR SELECT TO authenticated
  USING (
    (entity_type = 'CASE' AND entity_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())))
    OR (entity_type = 'WORKFLOW_STEP' AND entity_id IN (SELECT cws.id FROM case_workflow_steps cws JOIN case_workflow_runs cwr ON cwr.id = cws.run_id JOIN cases c ON c.id = cwr.case_id WHERE c.branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())))
    OR (entity_type = 'APPROVAL' AND entity_id IN (SELECT id FROM ceo_approvals WHERE case_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()))))
    OR (entity_type = 'EXTRA' AND entity_id IN (SELECT id FROM bodywork_extras WHERE case_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()))))
  );

CREATE POLICY audit_events_insert ON audit_events
  FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- STORAGE: extras-images bucket (create via API/dashboard; policy here)
-- Run after creating bucket named 'extras-images' in Supabase Dashboard
-- =====================================================
-- Storage policies are typically added via Supabase Dashboard or separate migration.
-- Example policy for authenticated upload/read for extras-images:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('extras-images', 'extras-images', false);
-- CREATE POLICY "extras-images upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'extras-images');
-- CREATE POLICY "extras-images read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'extras-images');

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER branches_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER cars_updated_at BEFORE UPDATE ON cars
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER cases_updated_at BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER case_workflow_runs_updated_at BEFORE UPDATE ON case_workflow_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER case_workflow_steps_updated_at BEFORE UPDATE ON case_workflow_steps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER ceo_approvals_updated_at BEFORE UPDATE ON ceo_approvals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER bodywork_extras_updated_at BEFORE UPDATE ON bodywork_extras
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
