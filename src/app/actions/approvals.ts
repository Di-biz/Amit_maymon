'use server';

import { createClient } from '@/lib/supabase/server';
import type { ApprovalDecisionInput } from '@/types/database';

export async function decideApproval(input: ApprovalDecisionInput) {
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
  if (profile?.role !== 'CEO') return { error: 'רק מנכ"ל יכול לאשר/לדחות' };

  const { data: approvalData } = await supabase
    .from('ceo_approvals')
    .select('id, case_id')
    .eq('id', input.approval_id)
    .single();
  if (!approvalData) return { error: 'אישור לא נמצא' };
  const approval = approvalData as { id: string; case_id: string };

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('ceo_approvals')
    .update({
      status: input.status,
      rejection_note: input.status === 'REJECTED' ? input.rejection_note ?? null : null,
      decided_at: now,
      decided_by: user.id,
    } as never)
    .eq('id', input.approval_id);

  if (updateErr) return { error: updateErr.message };

  const action = input.status === 'APPROVED' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED';
  await supabase.from('audit_events').insert({
    entity_type: 'APPROVAL',
    entity_id: input.approval_id,
    action,
    user_id: user.id,
    payload: { case_id: approval.case_id },
  } as never);

  if (input.status === 'REJECTED') {
    const { data: caseData } = await supabase
      .from('cases')
      .select('branch_id')
      .eq('id', approval.case_id)
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
        type: 'CEO_REJECTED',
        title: 'אישור נדחה',
        body: input.rejection_note ?? 'עמית דחה אישור',
      } as never);
    }
  }

  return { ok: true };
}
