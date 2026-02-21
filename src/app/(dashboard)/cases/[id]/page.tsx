import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import type { PartsStatus, GeneralStatus } from '@/types/database';
import { CaseDetailClient } from './CaseDetailClient';

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: caseRow } = await supabase
    .from('cases')
    .select(
      `
      id,
      case_key,
      claim_number,
      fixcar_link,
      parts_status,
      opened_at,
      treatment_finished_at,
      closed_at,
      general_status,
      branch_id,
      cars(license_plate, first_registration_date),
      branches(name)
    `
    )
    .eq('id', id)
    .single();

  if (!caseRow) notFound();

  const branchId = (caseRow as { branch_id: string }).branch_id;
  if (profile?.role !== 'CEO' && profile?.branch_id !== branchId) notFound();

  const { data: runData } = await supabase
    .from('case_workflow_runs')
    .select('id')
    .eq('case_id', id)
    .eq('workflow_type', 'PROFESSIONAL')
    .eq('status', 'ACTIVE')
    .maybeSingle();

  const run = runData as { id: string } | null;
  let steps: { id: string; step_key: string; state: string; order_index: number }[] = [];
  if (run) {
    const { data: stepsData } = await supabase
      .from('case_workflow_steps')
      .select('id, step_key, state, order_index')
      .eq('run_id', run.id)
      .order('order_index');
    steps = stepsData ?? [];
  }

  const { data: approvals } = await supabase
    .from('ceo_approvals')
    .select('id, approval_type, status, rejection_note')
    .eq('case_id', id);

  const { data: extras } = await supabase
    .from('bodywork_extras')
    .select('id, description, status')
    .eq('case_id', id);

  const stepIds = steps.map((s) => s.id);
  let auditRows: { id: string; action: string; user_id: string | null; created_at: string; payload: unknown }[] = [];
  const { data: caseAudit } = await supabase
    .from('audit_events')
    .select('id, action, user_id, created_at, payload')
    .eq('entity_type', 'CASE')
    .eq('entity_id', id);
  auditRows = (caseAudit ?? []) as typeof auditRows;
  if (stepIds.length > 0) {
    const { data: stepAudit } = await supabase
      .from('audit_events')
      .select('id, action, user_id, created_at, payload')
      .eq('entity_type', 'WORKFLOW_STEP')
      .in('entity_id', stepIds);
    auditRows = [...auditRows, ...((stepAudit ?? []) as typeof auditRows)];
  }
  auditRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  auditRows = auditRows.slice(0, 20);

  const car = Array.isArray((caseRow as { cars: unknown }).cars)
    ? (caseRow as { cars: { license_plate: string; first_registration_date: string | null }[] }).cars[0]
    : (caseRow as { cars: { license_plate: string; first_registration_date: string | null } | null }).cars;
  const branch = Array.isArray((caseRow as { branches: unknown }).branches)
    ? (caseRow as { branches: { name: string }[] }).branches[0]
    : (caseRow as { branches: { name: string } | null }).branches;
  const plate = car?.license_plate ?? '—';
  const firstReg = car?.first_registration_date ?? null;
  let age = '—';
  if (firstReg) {
    const years = (Date.now() - new Date(firstReg).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    age = years < 1 ? '<1' : Math.floor(years).toString();
  }

  return (
    <CaseDetailClient
      caseId={id}
      caseKey={(caseRow as { case_key: string | null }).case_key}
      claimNumber={(caseRow as { claim_number: string | null }).claim_number}
      plate={plate}
      branchName={branch?.name ?? '—'}
      openedAt={(caseRow as { opened_at: string | null }).opened_at}
      age={age}
      partsStatus={(caseRow as { parts_status: string }).parts_status as PartsStatus}
      generalStatus={(caseRow as { general_status: string }).general_status as GeneralStatus}
      fixcarLink={(caseRow as { fixcar_link: string | null }).fixcar_link}
      steps={steps}
      approvals={approvals ?? []}
      extras={extras ?? []}
      auditEvents={auditRows ?? []}
      role={profile?.role ?? null}
    />
  );
}
