-- =====================================================
-- Tehila Bodyshop CRM - Seed Test Users
-- Run in Supabase SQL Editor AFTER setup_all.sql
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  eran_id   UUID;
  amit_id   UUID;
  ilana_id  UUID;
  netivot_id UUID;
BEGIN
  SELECT id INTO netivot_id FROM branches WHERE name = 'נתיבות' LIMIT 1;

  -- ===== ערן - מנהל שירות =====
  SELECT id INTO eran_id FROM auth.users WHERE email = 'eran@tehila.test';
  IF eran_id IS NULL THEN
    eran_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_user_meta_data,
      created_at, updated_at, role, aud,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      eran_id, '00000000-0000-0000-0000-000000000000',
      'eran@tehila.test', crypt('Test1234!', gen_salt('bf')),
      NOW(), '{"full_name": "ערן"}',
      NOW(), NOW(), 'authenticated', 'authenticated',
      '', '', '', ''
    );
  END IF;
  UPDATE profiles SET role = 'SERVICE_MANAGER', branch_id = netivot_id, full_name = 'ערן' WHERE id = eran_id;

  -- ===== עמית - מנכ"ל =====
  SELECT id INTO amit_id FROM auth.users WHERE email = 'amit@tehila.test';
  IF amit_id IS NULL THEN
    amit_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_user_meta_data,
      created_at, updated_at, role, aud,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      amit_id, '00000000-0000-0000-0000-000000000000',
      'amit@tehila.test', crypt('Test1234!', gen_salt('bf')),
      NOW(), '{"full_name": "עמית"}',
      NOW(), NOW(), 'authenticated', 'authenticated',
      '', '', '', ''
    );
  END IF;
  UPDATE profiles SET role = 'CEO', branch_id = NULL, full_name = 'עמית' WHERE id = amit_id;

  -- ===== אילנה - משרד =====
  SELECT id INTO ilana_id FROM auth.users WHERE email = 'ilana@tehila.test';
  IF ilana_id IS NULL THEN
    ilana_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_user_meta_data,
      created_at, updated_at, role, aud,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      ilana_id, '00000000-0000-0000-0000-000000000000',
      'ilana@tehila.test', crypt('Test1234!', gen_salt('bf')),
      NOW(), '{"full_name": "אילנה"}',
      NOW(), NOW(), 'authenticated', 'authenticated',
      '', '', '', ''
    );
  END IF;
  UPDATE profiles SET role = 'OFFICE', branch_id = netivot_id, full_name = 'אילנה' WHERE id = ilana_id;

  RAISE NOTICE 'Done! eran / amit / ilana → Test1234!';
END $$;

-- בדיקה - צריך לראות 3 שורות
SELECT u.email, p.full_name, p.role, b.name AS branch
FROM auth.users u
JOIN profiles p ON p.id = u.id
LEFT JOIN branches b ON b.id = p.branch_id
WHERE u.email LIKE '%@tehila.test'
ORDER BY p.role;
