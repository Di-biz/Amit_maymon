-- =====================================================
-- Tehila Bodyshop CRM - COMPLETE SETUP (run once in Supabase SQL Editor)
-- Includes all migrations in correct order
-- Safe to run on a fresh Supabase project
-- =====================================================

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('SERVICE_MANAGER','OFFICE','CEO','PAINTER','SERVICE_ADVISOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE general_status AS ENUM ('NEW','IN_PROGRESS','COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE parts_status AS ENUM ('NO_PARTS','ORDERED','AVAILABLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE insurance_type AS ENUM ('COMPREHENSIVE','THIRD_PARTY','PRIVATE','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE claim_type AS ENUM ('PRIVATE','ACCIDENT','FLOOD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE workflow_type AS ENUM ('PROFESSIONAL','CLOSURE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE workflow_run_status AS ENUM ('ACTIVE','COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE step_state AS ENUM ('PENDING','ACTIVE','DONE','SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE approval_type AS ENUM ('ESTIMATE_AND_DETAILS','WHEELS_CHECK','CASE_CLOSURE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add CASE_CLOSURE to enum if it wasn't created above (existing projects)
DO $$ BEGIN
  ALTER TYPE approval_type ADD VALUE IF NOT EXISTS 'CASE_CLOSURE';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('PENDING','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE extra_status AS ENUM ('IN_TREATMENT','REJECTED','DONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_entity_type AS ENUM ('CASE','WORKFLOW_STEP','APPROVAL','EXTRA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- TABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  license_plate TEXT,
  make TEXT,
  model TEXT,
  year INTEGER,
  vin TEXT,
  first_registration_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  car_id UUID NOT NULL REFERENCES cars(id) ON DELETE RESTRICT,
  case_key TEXT,
  general_status general_status NOT NULL DEFAULT 'NEW',
  parts_status parts_status NOT NULL DEFAULT 'NO_PARTS',
  insurance_type insurance_type,
  claim_type claim_type,
  claim_number TEXT,
  fixcar_link TEXT,
  opened_at TIMESTAMPTZ,
  treatment_finished_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_workflow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  workflow_type workflow_type NOT NULL,
  status workflow_run_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_workflow_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES case_workflow_runs(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  state step_state NOT NULL DEFAULT 'PENDING',
  order_index INTEGER NOT NULL,
  activated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ceo_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  approval_type approval_type NOT NULL,
  status approval_status NOT NULL DEFAULT 'PENDING',
  rejection_note TEXT,
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bodywork_extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  image_path TEXT NOT NULL,
  status extra_status NOT NULL DEFAULT 'IN_TREATMENT',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type audit_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_cars_branch_id ON cars(branch_id);
CREATE INDEX IF NOT EXISTS idx_cars_license_plate ON cars(license_plate);
CREATE INDEX IF NOT EXISTS idx_cases_branch_id ON cases(branch_id);
CREATE INDEX IF NOT EXISTS idx_cases_car_id ON cases(car_id);
CREATE INDEX IF NOT EXISTS idx_cases_general_status ON cases(general_status);
CREATE INDEX IF NOT EXISTS idx_cases_closed_at ON cases(closed_at) WHERE closed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_case_key_branch ON cases(branch_id, case_key) WHERE case_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_case_workflow_runs_case_id ON case_workflow_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_case_workflow_runs_status ON case_workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_case_workflow_steps_run_id ON case_workflow_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_case_workflow_steps_step_key ON case_workflow_steps(step_key);
CREATE INDEX IF NOT EXISTS idx_ceo_approvals_case_id ON ceo_approvals(case_id);
CREATE INDEX IF NOT EXISTS idx_ceo_approvals_status ON ceo_approvals(status);
CREATE INDEX IF NOT EXISTS idx_bodywork_extras_case_id ON bodywork_extras(case_id);
CREATE INDEX IF NOT EXISTS idx_bodywork_extras_status ON bodywork_extras(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(user_id, type);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_case_documents_case_id ON case_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_case_documents_created_at ON case_documents(created_at DESC);

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Updated_at triggers (drop first if they exist, then recreate)
DROP TRIGGER IF EXISTS branches_updated_at ON branches;
CREATE TRIGGER branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS cars_updated_at ON cars;
CREATE TRIGGER cars_updated_at BEFORE UPDATE ON cars FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS cases_updated_at ON cases;
CREATE TRIGGER cases_updated_at BEFORE UPDATE ON cases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS case_workflow_runs_updated_at ON case_workflow_runs;
CREATE TRIGGER case_workflow_runs_updated_at BEFORE UPDATE ON case_workflow_runs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS case_workflow_steps_updated_at ON case_workflow_steps;
CREATE TRIGGER case_workflow_steps_updated_at BEFORE UPDATE ON case_workflow_steps FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS ceo_approvals_updated_at ON ceo_approvals;
CREATE TRIGGER ceo_approvals_updated_at BEFORE UPDATE ON ceo_approvals FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS bodywork_extras_updated_at ON bodywork_extras;
CREATE TRIGGER bodywork_extras_updated_at BEFORE UPDATE ON bodywork_extras FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS case_documents_updated_at ON case_documents;
CREATE TRIGGER case_documents_updated_at BEFORE UPDATE ON case_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- When a user signs up via Supabase Auth, create their profile automatically.
-- Role and branch_id must be updated manually by admin afterwards.
-- =====================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'SERVICE_ADVISOR' -- default role; admin must update to correct role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY
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
ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (idempotent)
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ----- branches -----
CREATE POLICY branches_select ON branches FOR SELECT TO authenticated USING (true);

-- ----- profiles -----
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO')
  );
CREATE POLICY profiles_update_own ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- ----- cars -----
CREATE POLICY cars_select ON cars FOR SELECT TO authenticated
  USING (
    branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO')
  );
CREATE POLICY cars_insert ON cars FOR INSERT TO authenticated
  WITH CHECK (branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY cars_update ON cars FOR UPDATE TO authenticated
  USING (branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()));

-- ----- cases -----
CREATE POLICY cases_select ON cases FOR SELECT TO authenticated
  USING (
    branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO')
  );
CREATE POLICY cases_insert ON cases FOR INSERT TO authenticated
  WITH CHECK (branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY cases_update ON cases FOR UPDATE TO authenticated
  USING (
    branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO')
  );

-- ----- case_workflow_runs -----
CREATE POLICY case_workflow_runs_select ON case_workflow_runs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO')
    OR case_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()))
  );
CREATE POLICY case_workflow_runs_insert ON case_workflow_runs FOR INSERT TO authenticated
  WITH CHECK (case_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY case_workflow_runs_update ON case_workflow_runs FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('CEO','OFFICE','SERVICE_MANAGER'))
    OR case_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()))
  );

-- ----- case_workflow_steps -----
CREATE POLICY case_workflow_steps_select ON case_workflow_steps FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO')
    OR run_id IN (
      SELECT cwr.id FROM case_workflow_runs cwr
      JOIN cases c ON c.id = cwr.case_id
      WHERE c.branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
    )
  );
CREATE POLICY case_workflow_steps_insert ON case_workflow_steps FOR INSERT TO authenticated
  WITH CHECK (
    run_id IN (
      SELECT cwr.id FROM case_workflow_runs cwr
      JOIN cases c ON c.id = cwr.case_id
      WHERE c.branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
    )
  );
CREATE POLICY case_workflow_steps_update ON case_workflow_steps FOR UPDATE TO authenticated
  USING (
    run_id IN (
      SELECT cwr.id FROM case_workflow_runs cwr
      JOIN cases c ON c.id = cwr.case_id
      WHERE c.branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ----- ceo_approvals -----
CREATE POLICY ceo_approvals_select ON ceo_approvals FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO')
    OR case_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()))
  );
CREATE POLICY ceo_approvals_insert ON ceo_approvals FOR INSERT TO authenticated
  WITH CHECK (
    case_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()))
  );
CREATE POLICY ceo_approvals_update ON ceo_approvals FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO')
    OR case_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()))
  );

-- ----- bodywork_extras -----
CREATE POLICY bodywork_extras_select ON bodywork_extras FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO')
    OR case_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()))
  );
CREATE POLICY bodywork_extras_insert ON bodywork_extras FOR INSERT TO authenticated
  WITH CHECK (
    case_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()))
    AND created_by = auth.uid()
  );
CREATE POLICY bodywork_extras_update ON bodywork_extras FOR UPDATE TO authenticated
  USING (case_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())));

-- ----- notifications -----
CREATE POLICY notifications_select ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_insert ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY notifications_update ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ----- audit_events -----
CREATE POLICY audit_events_insert ON audit_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY audit_events_select ON audit_events FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO')
    OR (entity_type = 'CASE' AND entity_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())))
    OR (entity_type = 'WORKFLOW_STEP' AND entity_id IN (
      SELECT cws.id FROM case_workflow_steps cws
      JOIN case_workflow_runs cwr ON cwr.id = cws.run_id
      JOIN cases c ON c.id = cwr.case_id
      WHERE c.branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
    ))
    OR (entity_type = 'APPROVAL' AND entity_id IN (SELECT id FROM ceo_approvals WHERE case_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()))))
    OR (entity_type = 'EXTRA' AND entity_id IN (SELECT id FROM bodywork_extras WHERE case_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()))))
  );

-- ----- case_documents -----
CREATE POLICY case_documents_select ON case_documents FOR SELECT TO authenticated
  USING (
    case_id IN (
      SELECT id FROM cases
      WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO')
    )
  );
CREATE POLICY case_documents_insert ON case_documents FOR INSERT TO authenticated
  WITH CHECK (
    case_id IN (
      SELECT id FROM cases
      WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
    )
    AND uploaded_by = auth.uid()
  );
CREATE POLICY case_documents_delete ON case_documents FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR (
      case_id IN (SELECT id FROM cases WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid()))
      AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SERVICE_MANAGER','OFFICE','CEO'))
    )
  );

-- =====================================================
-- SEED DATA: Branches (נתיבות + אשקלון)
-- =====================================================
INSERT INTO branches (name)
SELECT name FROM (VALUES ('נתיבות'), ('אשקלון')) AS t(name)
WHERE NOT EXISTS (SELECT 1 FROM branches b WHERE b.name = t.name);

-- =====================================================
-- STORAGE BUCKETS
-- Create these manually in Supabase Dashboard → Storage:
--   1. "extras-images"   (private)
--   2. "case-documents"  (private)
-- Then run the policies below.
-- =====================================================

-- extras-images policies
DO $$ BEGIN
  CREATE POLICY "extras-images upload" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'extras-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "extras-images read" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'extras-images');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- case-documents policies
DO $$ BEGIN
  CREATE POLICY "case-documents upload" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'case-documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "case-documents read" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'case-documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "case-documents delete" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'case-documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================
-- DONE!
-- Next steps:
-- 1. Create Storage buckets manually: "extras-images" and "case-documents" (private)
-- 2. Create users in Authentication → Users (or use invite)
-- 3. Update each user's profile: set correct role + branch_id in Table Editor → profiles
-- =====================================================
