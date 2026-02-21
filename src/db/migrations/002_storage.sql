-- =====================================================
-- Tehila Bodyshop CRM - Storage policies for extras-images
-- Migration: 002_storage.sql
-- Create bucket "extras-images" in Supabase Dashboard (Storage) first,
-- then run this migration to add RLS policies.
-- =====================================================

-- Policies for bucket: extras-images (must exist)
CREATE POLICY "extras-images authenticated upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'extras-images');

CREATE POLICY "extras-images authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'extras-images');
