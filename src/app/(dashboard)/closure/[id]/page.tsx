import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { ClosureDetailClient } from './ClosureDetailClient';

const CLOSURE_STEPS = [
  'CLOSURE_VERIFY_DETAILS_DOCS',
  'CLOSURE_PROFORMA_IF_NEEDED',
  'CLOSURE_PREPARE_CLOSING_FORMS',
  'CLOSE_CASE',
];

export default async function ClosureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single();

  const profile = profileData as { role: string; branch_id: string | null } | null;
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';
  if (!isPreview && profile?.role !== 'OFFICE' && profile?.role !== 'CEO') notFound();

  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, case_key, closed_at, branch_id, cars(license_plate)')
    .eq('id', id)
    .single();

  if (!caseRow || (caseRow as { closed_at: string | null }).closed_at) notFound();

  const branchId = (caseRow as { branch_id: string }).branch_id;
  if (profile && profile.role !== 'CEO' && profile.branch_id !== branchId) notFound();

  const { data: runData } = await supabase
    .from('case_workflow_runs')
    .select('id')
    .eq('case_id', id)
    .eq('workflow_type', 'CLOSURE')
    .maybeSingle();

  const existingRun = runData as { id: string } | null;
  let runId: string;
  let steps: { id: string; step_key: string; state: string; order_index: number }[] = [];

  if (existingRun?.id) {
    runId = existingRun.id;
    const { data: stepsData } = await supabase
      .from('case_workflow_steps')
      .select('id, step_key, state, order_index')
      .eq('run_id', runId)
      .order('order_index');
    steps = stepsData ?? [];
  } else {
    const { data: newRun } = await supabase
      .from('case_workflow_runs')
      .insert({ case_id: id, workflow_type: 'CLOSURE', status: 'ACTIVE' } as never)
      .select('id')
      .single();
    const newRunRow = newRun as { id: string } | null;
    if (!newRunRow?.id) notFound();
    runId = newRunRow.id;
    const closureActivatedAt = new Date().toISOString();
    for (let i = 0; i < CLOSURE_STEPS.length; i++) {
      await supabase.from('case_workflow_steps').insert({
        run_id: runId,
        step_key: CLOSURE_STEPS[i],
        state: i === 0 ? 'ACTIVE' : 'PENDING',
        order_index: i,
        activated_at: i === 0 ? closureActivatedAt : null,
      } as never);
    }
    const { data: stepsData } = await supabase
      .from('case_workflow_steps')
      .select('id, step_key, state, order_index')
      .eq('run_id', runId)
      .order('order_index');
    steps = stepsData ?? [];
  }

  const { data: extras } = await supabase
    .from('bodywork_extras')
    .select('id')
    .eq('case_id', id)
    .eq('status', 'IN_TREATMENT');
  const blockedByExtras = (extras?.length ?? 0) > 0;

  const { data: approvalsData } = await supabase
    .from('ceo_approvals')
    .select('approval_type, status')
    .eq('case_id', id);
  const approvals = (approvalsData ?? []) as { approval_type: string; status: string }[];
  const estimateOk = approvals.some(
    (a) => a.approval_type === 'ESTIMATE_AND_DETAILS' && a.status === 'APPROVED'
  );
  const wheelsDone = approvals.some((a) => a.approval_type === 'WHEELS_CHECK');
  const wheelsOk = !wheelsDone || approvals.some(
    (a) => a.approval_type === 'WHEELS_CHECK' && a.status === 'APPROVED'
  );
  const blockedByApprovals = !estimateOk || !wheelsOk;

  const car = Array.isArray((caseRow as { cars: unknown }).cars)
    ? (caseRow as { cars: { license_plate: string }[] }).cars[0]
    : (caseRow as { cars: { license_plate: string } | null }).cars;

  return (
    <ClosureDetailClient
      caseId={id}
      caseKey={(caseRow as { case_key: string | null }).case_key}
      plate={car?.license_plate ?? '—'}
      steps={steps}
      blockedByExtras={blockedByExtras}
      blockedByApprovals={blockedByApprovals}
      canClose={profile?.role === 'OFFICE' || profile?.role === 'CEO'}
    />
  );
}
