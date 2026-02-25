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
    .select('id, case_key, closed_at, branch_id, opened_at, parts_status, insurance_type, claim_number, cars(license_plate, make, model), branches(name)')
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
  // Check for CASE_CLOSURE approval (required for CLOSE_CASE step)
  const closureApproval = approvals.find((a) => a.approval_type === 'CASE_CLOSURE');
  // blockedByApprovals is only for estimate/wheels approvals (not closure approval)
  const blockedByApprovals = !estimateOk || !wheelsOk;

  const car = Array.isArray((caseRow as { cars: unknown }).cars)
    ? (caseRow as { cars: { license_plate: string; make: string | null; model: string | null }[] }).cars[0]
    : (caseRow as { cars: { license_plate: string; make: string | null; model: string | null } | null }).cars;

  const branch = Array.isArray((caseRow as { branches: unknown }).branches)
    ? (caseRow as { branches: { name: string }[] }).branches[0]
    : (caseRow as { branches: { name: string } | null }).branches;

  const row = caseRow as {
    case_key: string | null;
    opened_at: string | null;
    parts_status: string | null;
    insurance_type: string | null;
    claim_number: string | null;
  };

  return (
    <ClosureDetailClient
      caseId={id}
      caseKey={row.case_key}
      plate={car?.license_plate ?? '—'}
      carMake={car?.make ?? null}
      carModel={car?.model ?? null}
      branchName={branch?.name ?? '—'}
      openedAt={row.opened_at}
      partsStatus={row.parts_status}
      insuranceType={row.insurance_type}
      claimNumber={row.claim_number}
      steps={steps}
      blockedByExtras={blockedByExtras}
      blockedByApprovals={blockedByApprovals}
      canClose={isPreview || profile?.role === 'OFFICE' || profile?.role === 'CEO'}
      isPreview={isPreview}
      closureApprovalStatus={closureApproval?.status ?? null}
    />
  );
}
