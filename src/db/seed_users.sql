-- =====================================================
-- Tehila Bodyshop CRM - Seed Test Users
-- Run in Supabase SQL Editor AFTER setup_all.sql
-- Creates 3 users directly in auth.users + profiles
-- =====================================================

-- Make sure pgcrypto is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- Step 1: Create auth users directly
-- (The handle_new_user trigger will auto-create profiles)
-- =====================================================

DO $$
DECLARE
  eran_id   UUID := gen_random_uuid();
  amit_id   UUID := gen_random_uuid();
  ilana_id  UUID := gen_random_uuid();
  netivot_id UUID;
BEGIN
  -- Get נתיבות branch id
  SELECT id INTO netivot_id FROM branches WHERE name = 'נתיבות' LIMIT 1;

  -- ===== ערן - מנהל שירות =====
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data,
    created_at, updated_at, role, aud,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    eran_id,
    '00000000-0000-0000-0000-000000000000',
    'eran@tehila.test',
    crypt('Test1234!', gen_salt('bf')),
    NOW(),
    '{"full_name": "ערן"}',
    NOW(), NOW(), 'authenticated', 'authenticated',
    '', '', '', ''
  ) ON CONFLICT (email) DO NOTHING;

  -- Update ערן's profile (trigger created it with SERVICE_ADVISOR role)
  UPDATE profiles
  SET role = 'SERVICE_MANAGER', branch_id = netivot_id, full_name = 'ערן'
  WHERE id = eran_id;

  -- ===== עמית - מנכ"ל =====
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data,
    created_at, updated_at, role, aud,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    amit_id,
    '00000000-0000-0000-0000-000000000000',
    'amit@tehila.test',
    crypt('Test1234!', gen_salt('bf')),
    NOW(),
    '{"full_name": "עמית"}',
    NOW(), NOW(), 'authenticated', 'authenticated',
    '', '', '', ''
  ) ON CONFLICT (email) DO NOTHING;

  UPDATE profiles
  SET role = 'CEO', branch_id = NULL, full_name = 'עמית'
  WHERE id = amit_id;

  -- ===== אילנה - משרד =====
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data,
    created_at, updated_at, role, aud,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    ilana_id,
    '00000000-0000-0000-0000-000000000000',
    'ilana@tehila.test',
    crypt('Test1234!', gen_salt('bf')),
    NOW(),
    '{"full_name": "אילנה"}',
    NOW(), NOW(), 'authenticated', 'authenticated',
    '', '', '', ''
  ) ON CONFLICT (email) DO NOTHING;

  UPDATE profiles
  SET role = 'OFFICE', branch_id = netivot_id, full_name = 'אילנה'
  WHERE id = ilana_id;

  RAISE NOTICE 'Users created successfully!';
  RAISE NOTICE 'eran@tehila.test    → SERVICE_MANAGER (נתיבות)';
  RAISE NOTICE 'amit@tehila.test    → CEO';
  RAISE NOTICE 'ilana@tehila.test   → OFFICE (נתיבות)';
  RAISE NOTICE 'Password for all:   Test1234!';
END $$;

-- =====================================================
-- Verify: show created users and their profiles
-- =====================================================
SELECT
  u.email,
  p.full_name,
  p.role,
  b.name AS branch
FROM auth.users u
JOIN profiles p ON p.id = u.id
LEFT JOIN branches b ON b.id = p.branch_id
WHERE u.email LIKE '%@tehila.test'
ORDER BY p.role;
