-- =====================================================
-- Tehila Bodyshop CRM - Case Documents
-- Migration: 005_case_documents.sql
-- =====================================================

-- Create case_documents table
CREATE TABLE IF NOT EXISTS case_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Storage path in case-documents bucket
  file_size BIGINT, -- Size in bytes
  mime_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_case_documents_case_id ON case_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_case_documents_created_at ON case_documents(created_at DESC);

-- RLS Policies
ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;

-- Users can read documents for cases in their branch (or CEO can read all)
CREATE POLICY case_documents_select ON case_documents
  FOR SELECT TO authenticated
  USING (
    case_id IN (
      SELECT id FROM cases 
      WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO')
    )
  );

-- Users can upload documents for cases in their branch
CREATE POLICY case_documents_insert ON case_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    case_id IN (
      SELECT id FROM cases 
      WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'CEO')
    )
    AND uploaded_by = auth.uid()
  );

-- Users can delete their own documents or SERVICE_MANAGER/OFFICE can delete any in their branch
CREATE POLICY case_documents_delete ON case_documents
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR (
      case_id IN (
        SELECT id FROM cases 
        WHERE branch_id IN (SELECT branch_id FROM profiles WHERE id = auth.uid())
      )
      AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('SERVICE_MANAGER', 'OFFICE', 'CEO')
      )
    )
  );

-- Updated_at trigger
CREATE TRIGGER case_documents_updated_at
  BEFORE UPDATE ON case_documents
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- STORAGE: case-documents bucket
-- Create bucket "case-documents" in Supabase Dashboard (Storage) first,
-- then run the storage policies below.
-- =====================================================

-- Storage policies (run after creating bucket in Dashboard)
-- CREATE POLICY "case-documents authenticated upload"
-- ON storage.objects FOR INSERT TO authenticated
-- WITH CHECK (bucket_id = 'case-documents');

-- CREATE POLICY "case-documents authenticated read"
-- ON storage.objects FOR SELECT TO authenticated
-- USING (bucket_id = 'case-documents');

-- CREATE POLICY "case-documents authenticated delete"
-- ON storage.objects FOR DELETE TO authenticated
-- USING (bucket_id = 'case-documents');
