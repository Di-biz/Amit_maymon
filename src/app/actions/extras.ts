'use server';

import { createClient } from '@/lib/supabase/server';
import type { CreateExtraInput, UpdateExtraStatusInput } from '@/types/database';

export async function createExtra(input: CreateExtraInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'לא מחובר' };

  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();
  const profile = profileData as { id: string; role: string } | null;
  if (profile?.role !== 'PAINTER') return { error: 'רק פחח יכול ליצור תוספת' };

  const { data: extraData, error: insertErr } = await supabase
    .from('bodywork_extras')
    .insert({
      case_id: input.case_id,
      description: input.description,
      image_path: input.image_path,
      status: 'IN_TREATMENT',
      created_by: user.id,
    } as never)
    .select('id')
    .single();

  if (insertErr) return { error: insertErr.message };
  if (!extraData) return { error: 'שגיאה ביצירת תוספת' };
  const extra = extraData as { id: string };

  const { data: caseData } = await supabase
    .from('cases')
    .select('branch_id')
    .eq('id', input.case_id)
    .single();
  const branchId = (caseData as { branch_id: string } | null)?.branch_id;
  const { data: managers } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'SERVICE_MANAGER')
    .eq('branch_id', branchId ?? '');
  for (const m of (managers ?? []) as { id: string }[]) {
    await supabase.from('notifications').insert({
      user_id: m.id,
      type: 'EXTRA_CREATED',
      title: 'תוספת חדשה',
      body: input.description,
    } as never);
  }

  await supabase.from('audit_events').insert({
    entity_type: 'EXTRA',
    entity_id: extra.id,
    action: 'EXTRA_CREATED',
    user_id: user.id,
    payload: { case_id: input.case_id },
  } as never);

  return { extraId: extra.id };
}

export async function updateExtraStatus(input: UpdateExtraStatusInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'לא מחובר' };

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const profile = profileData as { role: string } | null;
  if (profile?.role !== 'SERVICE_MANAGER') return { error: 'רק מנהל שירות יכול לעדכן סטטוס' };

  const { error: updateErr } = await supabase
    .from('bodywork_extras')
    .update({ status: input.status } as never)
    .eq('id', input.extra_id);

  if (updateErr) return { error: updateErr.message };

  await supabase.from('audit_events').insert({
    entity_type: 'EXTRA',
    entity_id: input.extra_id,
    action: 'EXTRA_STATUS_CHANGED',
    user_id: user.id,
    payload: { status: input.status },
  } as never);

  return { ok: true };
}
