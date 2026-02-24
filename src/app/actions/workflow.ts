'use server';

import { createClient } from '@/lib/supabase/server';
import {
  PROFESSIONAL_WORKFLOW_STEPS,
  type CreateCaseInput,
  type UserRole,
  type AuditEntityType,
} from '@/types/database';

function vehicleAgeYears(firstRegistrationDate: string | null): number | null {
  if (!firstRegistrationDate) return null;
  const d = new Date(firstRegistrationDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return (now.getTime() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

async function writeAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entityType: AuditEntityType,
  entityId: string,
  action: string,
  userId: string | null,
  payload?: Record<string, unknown>
) {
  await supabase.from('audit_events').insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    user_id: userId,
    payload: payload ?? null,
  });
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createCase(input: CreateCaseInput) {
  const supabase = await createClient();
  if (!input.plate_number?.trim()) return { error: 'מספר רישוי חובה' };
  if (!input.first_registration_date) return { error: 'תאריך עלייה לכביש חובה' };
  if (!input.branch_id || !UUID_REGEX.test(input.branch_id)) return { error: 'סניף לא תקין' };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'לא מחובר' };

  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, role, branch_id')
    .eq('id', user.id)
    .single();

  const profile = profileData as { id: string; role: string; branch_id: string | null } | null;
  const role = profile?.role as UserRole | undefined;
  if (role !== 'SERVICE_MANAGER' && role !== 'OFFICE') {
    return { error: 'אין הרשאה ליצירת תיק' };
  }

  const branchId = input.branch_id;

  let carId: string;
  const { data: existingCar } = await supabase
    .from('cars')
    .select('id, first_registration_date')
    .eq('branch_id', branchId)
    .eq('license_plate', input.plate_number)
    .maybeSingle();

  if (existingCar) {
    carId = existingCar.id;
    if (input.first_registration_date) {
      await supabase
        .from('cars')
        .update({ first_registration_date: input.first_registration_date })
        .eq('id', carId);
    }
  } else {
    const { data: newCar, error: carErr } = await supabase
      .from('cars')
      .insert({
        branch_id: branchId,
        license_plate: input.plate_number,
        first_registration_date: input.first_registration_date,
      })
      .select('id')
      .single();
    if (carErr || !newCar) return { error: carErr?.message ?? 'שגיאה ביצירת רכב' };
    carId = newCar.id;
  }

  const caseKey = `${input.plate_number}-${input.claim_number ?? 'PRIVATE'}`;
  const openedAt = new Date().toISOString();

  const { data: newCase, error: caseErr } = await supabase
    .from('cases')
    .insert({
      branch_id: branchId,
      car_id: carId,
      case_key: caseKey,
      claim_number: input.claim_number ?? null,
      insurance_type: input.insurance_type ?? null,
      claim_type: input.claim_type ?? null,
      opened_at: openedAt,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (caseErr || !newCase) return { error: caseErr?.message ?? 'שגיאה ביצירת תיק' };
  const caseId = (newCase as { id: string }).id;
  if (!caseId) return { error: 'לא התקבל מזהה תיק' };

  const { data: run, error: runErr } = await supabase
    .from('case_workflow_runs')
    .insert({
      case_id: caseId,
      workflow_type: 'PROFESSIONAL',
      status: 'ACTIVE',
    })
    .select('id')
    .single();

  if (runErr || !run) return { error: runErr?.message ?? 'שגיאה ביצירת workflow' };
  const runId = run.id;

  const age = vehicleAgeYears(input.first_registration_date);
  const skipWheels = age !== null && age <= 2;

  for (let i = 0; i < PROFESSIONAL_WORKFLOW_STEPS.length; i++) {
    const stepKey = PROFESSIONAL_WORKFLOW_STEPS[i];
    let state: 'PENDING' | 'ACTIVE' | 'DONE' | 'SKIPPED' = 'ACTIVE'; // All steps start as ACTIVE for testing
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
      // All other steps should be ACTIVE
      state = 'ACTIVE';
      activatedAt = openedAt;
      completedAt = null;
    }

    await supabase.from('case_workflow_steps').insert({
      run_id: runId,
      step_key: stepKey,
      state,
      order_index: i,
      activated_at: activatedAt,
      completed_at: completedAt,
    });
  }

  await writeAudit(supabase, 'CASE', caseId, 'CASE_CREATED', user.id, { case_key: caseKey });
  await writeAudit(supabase, 'WORKFLOW_STEP', runId, 'STEP_ACTIVATED', user.id, {
    step_key: 'FIXCAR_PHOTOS',
  });
  if (skipWheels) {
    const steps = await supabase
      .from('case_workflow_steps')
      .select('id')
      .eq('run_id', runId)
      .eq('step_key', 'WHEELS_CHECK')
      .single();
    if (steps.data)
      await writeAudit(supabase, 'WORKFLOW_STEP', steps.data.id, 'STEP_SKIPPED', user.id, {
        reason: 'vehicle_age_under_2',
      });
  }

  return { caseId: String(caseId) };
}

export async function completeActiveStep(caseId: string, stepId?: string) {
  console.log('[WORKFLOW ACTION] completeActiveStep called:', { caseId, stepId });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error('[WORKFLOW ACTION] User not logged in');
    return { error: 'לא מחובר' };
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();
  const profile = profileData as { id: string; role: string } | null;
  const role = profile?.role as UserRole | undefined;

  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, fixcar_link, parts_status')
    .eq('id', caseId)
    .single();
  if (!caseRow) return { error: 'תיק לא נמצא' };

  const { data: run } = await supabase
    .from('case_workflow_runs')
    .select('id, workflow_type')
    .eq('case_id', caseId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (!run) return { error: 'לא נמצא workflow פעיל' };

  const isClosure = run.workflow_type === 'CLOSURE';
  if (isClosure && role !== 'OFFICE') return { error: 'רק משרד יכול להשלים שלבי סגירה' };
  if (!isClosure && role !== 'SERVICE_MANAGER') return { error: 'רק מנהל שירות יכול להשלים שלב' };

  let activeStep: { id: string; step_key: string; order_index: number } | null = null;
  
  if (stepId) {
    // Complete specific step by ID
    const { data: stepData } = await supabase
      .from('case_workflow_steps')
      .select('id, step_key, order_index, state')
      .eq('id', stepId)
      .eq('run_id', run.id)
      .single();
    if (!stepData) return { error: 'שלב לא נמצא' };
    if (stepData.state !== 'ACTIVE' && stepData.state !== 'PENDING') {
      return { error: 'שלב זה כבר הושלם או דולג' };
    }
    activeStep = stepData as { id: string; step_key: string; order_index: number };
  } else {
    // Find first active step (backward compatibility)
    const { data: activeSteps } = await supabase
      .from('case_workflow_steps')
      .select('id, step_key, order_index')
      .eq('run_id', run.id)
      .eq('state', 'ACTIVE')
      .order('order_index', { ascending: true })
      .limit(1);
    activeStep = activeSteps && activeSteps.length > 0 ? activeSteps[0] : null;
    if (!activeStep) return { error: 'אין שלב פעיל להשלמה' };
  }

  const stepKey = activeStep.step_key;

  if (stepKey === 'FIXCAR_PHOTOS' && !caseRow.fixcar_link) {
    await supabase.from('notifications').insert({
      user_id: profile!.id,
      type: 'BLOCKED_ACTION',
      title: 'פעולה חסומה',
      body: 'לא ניתן להשלים צילום FixCar ללא קישור',
    });
    await writeAudit(supabase, 'WORKFLOW_STEP', activeStep.id, 'BLOCKED_ACTION', user.id, {
      reason: 'fixcar_link_missing',
    });
    return { error: 'נדרש קישור FixCar' };
  }

  if (stepKey === 'ENTER_WORK' && caseRow.parts_status !== 'AVAILABLE') {
    await supabase.from('notifications').insert({
      user_id: profile!.id,
      type: 'BLOCKED_ACTION',
      title: 'פעולה חסומה',
      body: 'לא ניתן להיכנס לעבודה ללא חלקים זמינים',
    });
    await writeAudit(supabase, 'WORKFLOW_STEP', activeStep.id, 'BLOCKED_ACTION', user.id, {
      reason: 'parts_not_available',
    });
    return { error: 'סטטוס חלקים חייב להיות זמין' };
  }

  if (stepKey === 'READY_FOR_OFFICE' || stepKey === 'CLOSE_CASE') {
    const { data: extras } = await supabase
      .from('bodywork_extras')
      .select('id')
      .eq('case_id', caseId)
      .eq('status', 'IN_TREATMENT');
    if (extras && extras.length > 0) {
      await supabase.from('notifications').insert({
        user_id: profile!.id,
        type: 'BLOCKED_ACTION',
        title: 'פעולה חסומה',
        body: 'קיימות תוספות בטיפול',
      });
      await writeAudit(supabase, 'WORKFLOW_STEP', activeStep.id, 'BLOCKED_ACTION', user.id, {
        reason: 'extras_in_treatment',
      });
      return { error: 'יש תוספות בטיפול' };
    }
    const { data: approvals } = await supabase
      .from('ceo_approvals')
      .select('approval_type, status')
      .eq('case_id', caseId);
    const estimateApproval = (approvals ?? []).find((a) => a.approval_type === 'ESTIMATE_AND_DETAILS');
    const wheelsApproval = (approvals ?? []).find((a) => a.approval_type === 'WHEELS_CHECK');
    const { data: wheelsStep } = await supabase
      .from('case_workflow_steps')
      .select('id')
      .eq('run_id', run.id)
      .eq('step_key', 'WHEELS_CHECK')
      .eq('state', 'DONE')
      .maybeSingle();
    const needsWheelsApproval = !!wheelsStep?.id;
    if (!estimateApproval || estimateApproval.status !== 'APPROVED') {
      await supabase.from('notifications').insert({
        user_id: profile!.id,
        type: 'BLOCKED_ACTION',
        title: 'פעולה חסומה',
        body: 'חסר או נדחה אישור CEO לאומדן',
      });
      await writeAudit(supabase, 'WORKFLOW_STEP', activeStep.id, 'BLOCKED_ACTION', user.id, {
        reason: 'ceo_approval_missing_or_rejected',
      });
      return { error: 'נדרש אישור CEO לאומדן' };
    }
    if (needsWheelsApproval && (!wheelsApproval || wheelsApproval.status !== 'APPROVED')) {
      await supabase.from('notifications').insert({
        user_id: profile!.id,
        type: 'BLOCKED_ACTION',
        title: 'פעולה חסומה',
        body: 'חסר או נדחה אישור CEO לבדיקת גלגלים',
      });
      await writeAudit(supabase, 'WORKFLOW_STEP', activeStep.id, 'BLOCKED_ACTION', user.id, {
        reason: 'ceo_approval_missing_or_rejected',
      });
      return { error: 'נדרש אישור CEO לבדיקת גלגלים' };
    }
  }

  if (stepKey === 'WAIT_APPRAISER_APPROVAL') {
    const { data: existingApprovals } = await supabase
      .from('ceo_approvals')
      .select('approval_type')
      .eq('case_id', caseId);
    const types = new Set((existingApprovals ?? []).map((a) => a.approval_type));
    if (!types.has('ESTIMATE_AND_DETAILS')) {
      await supabase.from('ceo_approvals').insert({
        case_id: caseId,
        approval_type: 'ESTIMATE_AND_DETAILS',
        status: 'PENDING',
      });
    }
    const { data: wheelsStep } = await supabase
      .from('case_workflow_steps')
      .select('id')
      .eq('run_id', run.id)
      .eq('step_key', 'WHEELS_CHECK')
      .eq('state', 'DONE')
      .maybeSingle();
    if (wheelsStep && !types.has('WHEELS_CHECK')) {
      await supabase.from('ceo_approvals').insert({
        case_id: caseId,
        approval_type: 'WHEELS_CHECK',
        status: 'PENDING',
      });
    }
  }

  const now = new Date().toISOString();
  console.log('[WORKFLOW ACTION] Updating step to DONE:', { stepId: activeStep.id, stepKey, now });
  const updateResult = await supabase
    .from('case_workflow_steps')
    .update({
      state: 'DONE',
      completed_at: now,
      completed_by: user.id,
    })
    .eq('id', activeStep.id);
  console.log('[WORKFLOW ACTION] Update result:', updateResult);

  if (stepKey === 'READY_FOR_OFFICE') {
    await supabase
      .from('cases')
      .update({ treatment_finished_at: now })
      .eq('id', caseId);
  }

  if (stepKey === 'CLOSE_CASE') {
    await supabase.from('cases').update({ closed_at: now, general_status: 'COMPLETED' }).eq('id', caseId);
    await supabase.from('case_workflow_runs').update({ status: 'COMPLETED' }).eq('id', run.id);
    await writeAudit(supabase, 'CASE', caseId, 'CASE_CLOSED', user.id);
  }

  const nextOrder = activeStep.order_index + 1;
  const { data: nextSteps } = await supabase
    .from('case_workflow_steps')
    .select('id')
    .eq('run_id', run.id)
    .eq('order_index', nextOrder)
    .limit(1);
  if (nextSteps && nextSteps.length > 0) {
    await supabase
      .from('case_workflow_steps')
      .update({ state: 'ACTIVE', activated_at: now })
      .eq('id', nextSteps[0].id);
  } else if (run.workflow_type === 'PROFESSIONAL') {
    await supabase.from('case_workflow_runs').update({ status: 'COMPLETED' }).eq('id', run.id);
  }

  await writeAudit(supabase, 'WORKFLOW_STEP', activeStep.id, 'STEP_COMPLETED', user.id, {
    step_key: stepKey,
  });

  console.log('[WORKFLOW ACTION] Step completed successfully:', { stepId: activeStep.id, stepKey });
  return { ok: true, error: null };
}

export async function returnToEstimate(caseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'לא מחובר' };

  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const profile = profileData as { role: string } | null;
  if (profile?.role !== 'SERVICE_MANAGER') return { error: 'רק מנהל שירות יכול להחזיר לאומדן' };

  const { data: run } = await supabase
    .from('case_workflow_runs')
    .select('id')
    .eq('case_id', caseId)
    .eq('workflow_type', 'PROFESSIONAL')
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (!run) return { error: 'לא נמצא workflow מקצועי פעיל' };

  const prepStep = await supabase
    .from('case_workflow_steps')
    .select('id')
    .eq('run_id', run.id)
    .eq('step_key', 'PREP_ESTIMATE')
    .single();
  if (!prepStep.data) return { error: 'שלב PREP_ESTIMATE לא נמצא' };

  await supabase
    .from('case_workflow_steps')
    .update({ state: 'PENDING' })
    .eq('run_id', run.id)
    .eq('state', 'ACTIVE');
  const now = new Date().toISOString();
  await supabase
    .from('case_workflow_steps')
    .update({ state: 'ACTIVE', activated_at: now })
    .eq('id', prepStep.data.id);

  await writeAudit(supabase, 'WORKFLOW_STEP', prepStep.data.id, 'RETURNED_TO_ESTIMATE', user.id);
  return { ok: true };
}
