import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import type { PartsStatus, GeneralStatus } from '@/types/database';
import { PROFESSIONAL_WORKFLOW_STEPS } from '@/types/database';
import { CaseDetailClientV2 } from './CaseDetailClientV2';

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

  // CRITICAL FIX: Load steps by case_id (through all runs) to find steps even if run_id changes
  // First, get all runs for this case
  const { data: allRuns } = await supabase
    .from('case_workflow_runs')
    .select('id')
    .eq('case_id', id)
    .eq('workflow_type', 'PROFESSIONAL');
  
  let steps: { id: string; step_key: string; state: string; order_index: number }[] = [];
  
  if (allRuns && allRuns.length > 0) {
    // Get all run IDs for this case
    const runIds = allRuns.map((r) => (r as { id: string }).id);
    // Load steps for any of these runs
    const { data: stepsData } = await supabase
      .from('case_workflow_steps')
      .select('id, step_key, state, order_index')
      .in('run_id', runIds)
      .order('order_index');
    steps = stepsData ?? [];
    
    // DEBUG: Log what we found
    if (process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true') {
      console.log('[CASE DETAIL PAGE] Loaded steps by case_id:', {
        caseId: id,
        allRunsCount: allRuns.length,
        runIds,
        stepsCount: steps.length,
        steps: steps.map(s => ({ step_key: s.step_key, state: s.state })),
      });
    }
  } else {
    // DEBUG: Log if no runs found
    if (process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true') {
      console.log('[CASE DETAIL PAGE] No runs found for case:', id);
    }
  }
  
  // Get the active run for display
  const { data: runData } = await supabase
    .from('case_workflow_runs')
    .select('id')
    .eq('case_id', id)
    .eq('workflow_type', 'PROFESSIONAL')
    .eq('status', 'ACTIVE')
    .maybeSingle();
  
  const run = runData as { id: string } | null;
  
  // DEBUG: Log run status
  if (process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true') {
    console.log('[CASE DETAIL PAGE] Run check:', {
      caseId: id,
      hasRun: !!run,
      runId: run?.id,
      stepsCount: steps.length,
    });
  }
  
  // CRITICAL FIX: In PREVIEW mode, use the first run we found (don't create a new one)
  // This prevents creating duplicate runs that break the step lookup
  let actualRun = run;
  if (process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true') {
    // If we have runs but no active run, use the first one
    if (!run && allRuns && allRuns.length > 0) {
      actualRun = { id: (allRuns[0] as { id: string }).id };
      console.log('[CASE DETAIL PAGE] Using existing run instead of creating new one:', actualRun.id);
    } else if (!run) {
      // Only create a new run if there are NO runs at all
      console.log('[CASE DETAIL PAGE] No run found, creating one for case:', id);
      const { data: newRunData } = await supabase
        .from('case_workflow_runs')
        .insert({
          case_id: id,
          workflow_type: 'PROFESSIONAL',
          status: 'ACTIVE',
        } as never)
        .select('id')
        .single();
      if (newRunData) {
        actualRun = newRunData as { id: string };
        console.log('[CASE DETAIL PAGE] Created new run:', actualRun.id);
      }
    }
  }
  
  // If we still have no steps but have a run, try loading by run_id
  if (actualRun && steps.length === 0) {
    const { data: stepsData } = await supabase
      .from('case_workflow_steps')
      .select('id, step_key, state, order_index')
      .eq('run_id', actualRun.id)
      .order('order_index');
    steps = stepsData ?? [];
    
    // DEBUG: Log if no steps found
    if (process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true') {
      console.log('[CASE DETAIL PAGE] Steps check:', {
        runId: actualRun.id,
        stepsCount: steps.length,
        hasRun: !!actualRun,
      });
    }
    
    // CRITICAL FIX: If we have a run but no steps, create them (PREVIEW mode only)
    // This happens because steps are created on server but not saved to localStorage
    if (process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true' && steps.length === 0) {
      console.log('[CASE DETAIL PAGE] Creating missing workflow steps for run:', actualRun.id);
      const openedAt = (caseRow as { opened_at: string | null }).opened_at || new Date().toISOString();
      // Extract car data from caseRow
      const carData = Array.isArray((caseRow as { cars: unknown }).cars)
        ? (caseRow as { cars: { license_plate: string; first_registration_date: string | null }[] }).cars[0]
        : (caseRow as { cars: { license_plate: string; first_registration_date: string | null } | null }).cars;
      const firstReg = carData?.first_registration_date ?? null;
      const age = firstReg ? (Date.now() - new Date(firstReg).getTime()) / (365.25 * 24 * 60 * 60 * 1000) : null;
      const skipWheels = age !== null && age <= 2;
      
      // Create all steps with correct states
      for (let i = 0; i < PROFESSIONAL_WORKFLOW_STEPS.length; i++) {
        const stepKey = PROFESSIONAL_WORKFLOW_STEPS[i];
        let state: 'PENDING' | 'ACTIVE' | 'DONE' | 'SKIPPED' = 'ACTIVE';
        let completedAt: string | null = null;
        let activatedAt: string | null = openedAt;
        
        if (stepKey === 'OPEN_CASE') {
          state = 'DONE';
          completedAt = openedAt;
          activatedAt = openedAt;
        } else if (stepKey === 'WHEELS_CHECK' && skipWheels) {
          state = 'SKIPPED';
          completedAt = openedAt;
          activatedAt = null;
        } else {
          state = 'ACTIVE';
          activatedAt = openedAt;
          completedAt = null;
        }
        
        await supabase.from('case_workflow_steps').insert({
          run_id: actualRun.id,
          step_key: stepKey,
          state,
          order_index: i,
          activated_at: activatedAt,
          completed_at: completedAt,
        } as never);
      }
      
      // Reload steps after creating them
      const { data: newStepsData } = await supabase
        .from('case_workflow_steps')
        .select('id, step_key, state, order_index')
        .eq('run_id', actualRun.id)
        .order('order_index');
      steps = newStepsData ?? [];
      
      // DEBUG: Log after creating steps
      if (process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true') {
        console.log('[CASE DETAIL PAGE] Created and loaded steps:', {
          runId: actualRun.id,
          stepsCount: steps.length,
          steps: steps.map(s => ({ step_key: s.step_key, state: s.state })),
        });
      }
    }
    
    // DEBUG: Log steps loading
    if (process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true') {
      console.log('[CASE DETAIL PAGE] Loaded steps:', {
        runId: actualRun.id,
        caseId: id,
        stepsCount: steps.length,
        steps: steps.map(s => ({ step_key: s.step_key, state: s.state })),
      });
    }
  } else {
    // DEBUG: Log if run not found (and couldn't create one)
    if (process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true') {
      console.warn('[CASE DETAIL PAGE] No workflow run found for case and couldn\'t create one:', id);
    }
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
    <CaseDetailClientV2
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
