'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { completeActiveStep } from '@/app/actions/workflow';

const STEP_LABELS: Record<string, string> = {
  CLOSURE_VERIFY_DETAILS_DOCS: 'אימות פרטים ומסמכים',
  CLOSURE_PROFORMA_IF_NEEDED: 'פרופורמה במידת הצורך',
  CLOSURE_PREPARE_CLOSING_FORMS: 'הכנת טפסי סגירה',
  CLOSE_CASE: 'סגירת תיק',
};

const STEP_ICONS: Record<string, string> = {
  CLOSURE_VERIFY_DETAILS_DOCS: '📋',
  CLOSURE_PROFORMA_IF_NEEDED: '🧾',
  CLOSURE_PREPARE_CLOSING_FORMS: '📝',
  CLOSE_CASE: '🔒',
};

const PARTS_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  AVAILABLE: { label: 'זמינים ✅', color: 'text-green-700' },
  ORDERED: { label: 'הוזמנו ⏳', color: 'text-yellow-700' },
  NO_PARTS: { label: 'אין חלקים ❌', color: 'text-red-700' },
};

const INSURANCE_TYPE_LABELS: Record<string, string> = {
  PRIVATE: 'פרטי',
  COMPREHENSIVE: 'מקיף',
  THIRD_PARTY: 'צד ג׳',
};

type StepState = 'ACTIVE' | 'PENDING' | 'DONE' | 'SKIPPED';
type StepRow = { id: string; step_key: string; state: StepState; order_index: number };

interface ClosureDetailClientProps {
  caseId: string;
  caseKey: string | null;
  plate: string;
  carMake: string | null;
  carModel: string | null;
  branchName: string;
  openedAt: string | null;
  partsStatus: string | null;
  insuranceType: string | null;
  claimNumber: string | null;
  steps: StepRow[];
  blockedByExtras: boolean;
  blockedByApprovals: boolean;
  canClose: boolean;
  isPreview?: boolean;
  closureApprovalStatus?: string | null;
}

export function ClosureDetailClient({
  caseId,
  caseKey,
  plate,
  carMake,
  carModel,
  branchName,
  openedAt,
  partsStatus,
  insuranceType,
  claimNumber,
  steps,
  blockedByExtras,
  blockedByApprovals,
  canClose,
  isPreview = false,
  closureApprovalStatus,
}: ClosureDetailClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In PREVIEW, start empty and load from mock client (localStorage)
  const [localSteps, setLocalSteps] = useState<StepRow[]>(isPreview ? [] : steps);
  const initRef = useRef<string | null>(null);
  const [completingStepId, setCompletingStepId] = useState<string | null>(null);

  useEffect(() => {
    if (!isPreview) return;
    if (initRef.current === caseId) return;
    initRef.current = caseId;

    (async () => {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data: runs } = await supabase
        .from('case_workflow_runs')
        .select('id')
        .eq('case_id', caseId)
        .eq('workflow_type', 'CLOSURE');
      const runIds = (runs as { id: string }[] | null)?.map((r) => r.id) ?? [];
      if (runIds.length === 0) return;

      const { data: stepsData } = await supabase
        .from('case_workflow_steps')
        .select('id, step_key, state, order_index')
        .in('run_id', runIds)
        .order('order_index');

      if (stepsData && stepsData.length > 0) {
        // Normalize: due to mock-client "fix" code, some PENDING steps become ACTIVE.
        // Re-apply sequential ordering: first non-DONE is ACTIVE, rest are PENDING.
        const raw = (stepsData as StepRow[]).sort((a, b) => a.order_index - b.order_index);
        const normalized = normalizeStepStates(raw);
        setLocalSteps(normalized);
      }
    })().catch(console.error);
  }, [isPreview, caseId]);

  // Reload steps after completion to ensure persistence
  useEffect(() => {
    if (!isPreview) return;
    if (completingStepId !== null) return; // Don't reload while completing

    const reloadSteps = async () => {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data: runs } = await supabase
        .from('case_workflow_runs')
        .select('id')
        .eq('case_id', caseId)
        .eq('workflow_type', 'CLOSURE');
      const runIds = (runs as { id: string }[] | null)?.map((r) => r.id) ?? [];
      if (runIds.length === 0) return;

      const { data: stepsData } = await supabase
        .from('case_workflow_steps')
        .select('id, step_key, state, order_index')
        .in('run_id', runIds)
        .order('order_index');

      if (stepsData && stepsData.length > 0) {
        const raw = (stepsData as StepRow[]).sort((a, b) => a.order_index - b.order_index);
        const normalized = normalizeStepStates(raw);
        setLocalSteps(normalized);
      }
    };

    const timer = setTimeout(() => {
      reloadSteps().catch(console.error);
    }, 500);

    return () => clearTimeout(timer);
  }, [isPreview, caseId, completingStepId]);

  // Re-apply sequential step states: first non-DONE = ACTIVE, rest = PENDING
  function normalizeStepStates(raw: StepRow[]): StepRow[] {
    let foundActive = false;
    return raw.map((s) => {
      if (s.state === 'DONE') return s;
      if (!foundActive) {
        foundActive = true;
        return { ...s, state: 'ACTIVE' };
      }
      return { ...s, state: 'PENDING' };
    });
  }

  const effectiveSteps = localSteps.length > 0 ? localSteps : steps;
  const orderedSteps = [...effectiveSteps].sort((a, b) => a.order_index - b.order_index);
  // Normalize to ensure sequential state (first non-DONE is ACTIVE)
  const normalizedSteps = normalizeStepStates(orderedSteps);
  const activeStep = normalizedSteps.find((s) => s.state === 'ACTIVE');
  
  // In PREVIEW mode, check closure approval from localStorage
  const [localClosureApproval, setLocalClosureApproval] = useState<string | null>(closureApprovalStatus ?? null);
  useEffect(() => {
    if (!isPreview) return;
    (async () => {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data } = await supabase
        .from('ceo_approvals')
        .select('status')
        .eq('case_id', caseId)
        .eq('approval_type', 'CASE_CLOSURE')
        .maybeSingle();
      if (data) setLocalClosureApproval((data as { status: string }).status);
    })().catch(console.error);
  }, [isPreview, caseId]);
  
  const effectiveClosureApproval = isPreview ? localClosureApproval : closureApprovalStatus;
  // CLOSE_CASE is blocked if: extras in treatment OR missing closure approval
  // Other steps are blocked by blockedByApprovals (estimate/wheels)
  // Don't show warning if case is already closed
  const isCaseClosed = allDone;
  const closeBlocked = activeStep?.step_key === 'CLOSE_CASE' 
    ? (blockedByExtras || effectiveClosureApproval !== 'APPROVED')
    : (blockedByExtras || blockedByApprovals);
  const allDone = normalizedSteps.length > 0 && normalizedSteps.every((s) => s.state === 'DONE');
  const doneCount = normalizedSteps.filter((s) => s.state === 'DONE').length;

  const parts = partsStatus ? PARTS_STATUS_LABELS[partsStatus] : null;
  const daysOpen = openedAt
    ? Math.floor((Date.now() - new Date(openedAt).getTime()) / 86400000)
    : null;

  async function completePreviewStep(step: StepRow) {
    const supabase = (await import('@/lib/supabase/client')).createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const now = new Date().toISOString();

    // Mark step DONE in mock store
    await supabase
      .from('case_workflow_steps')
      .update({ state: 'DONE', completed_at: now, completed_by: user?.id ?? null } as never)
      .eq('id', step.id);

    // Find next non-done step to activate
    const sorted = [...normalizedSteps].sort((a, b) => a.order_index - b.order_index);
    const nextStep = sorted.find((s) => s.order_index > step.order_index && s.state !== 'DONE');
    if (nextStep) {
      await supabase
        .from('case_workflow_steps')
        .update({ state: 'ACTIVE', activated_at: now } as never)
        .eq('id', nextStep.id);
    }

    // CLOSURE_PREPARE_CLOSING_FORMS: create CEO approval for case closure
    if (step.step_key === 'CLOSURE_PREPARE_CLOSING_FORMS') {
      // Check if approval already exists
      const { data: existing } = await supabase
        .from('ceo_approvals')
        .select('id')
        .eq('case_id', caseId)
        .eq('approval_type', 'CASE_CLOSURE')
        .maybeSingle();
      
      if (!existing) {
        await supabase.from('ceo_approvals').insert({
          case_id: caseId,
          approval_type: 'CASE_CLOSURE',
          status: 'PENDING',
        } as never);
      }
    }

    // CLOSE_CASE: finalize the case (only if approval is granted)
    if (step.step_key === 'CLOSE_CASE') {
      // Check if CEO approval exists and is approved
      const { data: closureApproval } = await supabase
        .from('ceo_approvals')
        .select('status')
        .eq('case_id', caseId)
        .eq('approval_type', 'CASE_CLOSURE')
        .maybeSingle();
      
      if (closureApproval && (closureApproval as { status: string }).status === 'APPROVED') {
        await supabase
          .from('cases')
          .update({ closed_at: now, general_status: 'COMPLETED' } as never)
          .eq('id', caseId);
      }
    }

    // Update local state IMMEDIATELY for instant UI feedback
    setLocalSteps(
      sorted.map((s) => {
        if (s.id === step.id) return { ...s, state: 'DONE' };
        if (nextStep && s.id === nextStep.id) return { ...s, state: 'ACTIVE' };
        if (s.order_index > step.order_index && s.id !== nextStep?.id) return { ...s, state: 'PENDING' };
        return s;
      })
    );
    
    // Then reload from mock store to ensure persistence (async, doesn't block UI)
    setTimeout(async () => {
      const { data: runs } = await supabase
        .from('case_workflow_runs')
        .select('id')
        .eq('case_id', caseId)
        .eq('workflow_type', 'CLOSURE');
      const runIds = (runs as { id: string }[] | null)?.map((r) => r.id) ?? [];
      if (runIds.length > 0) {
        const { data: updatedSteps } = await supabase
          .from('case_workflow_steps')
          .select('id, step_key, state, order_index')
          .in('run_id', runIds)
          .order('order_index');
        
        if (updatedSteps && updatedSteps.length > 0) {
          const raw = (updatedSteps as StepRow[]).sort((a, b) => a.order_index - b.order_index);
          const normalized = normalizeStepStates(raw);
          setLocalSteps(normalized);
        }
      }
    }, 100);
  }

  async function handleCompleteStep() {
    if (!activeStep) return;
    setError(null);
    setLoading(true);
    setCompletingStepId(activeStep.id);
    try {
      if (isPreview) {
        await completePreviewStep(activeStep);
      } else {
        const res = await completeActiveStep(caseId);
        if (res?.error) setError(res.error);
        else router.refresh();
      }
    } catch (e) {
      console.error('[ClosureDetailClient] error:', e);
      setError('שגיאה בהשלמת השלב');
    } finally {
      setLoading(false);
      setCompletingStepId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/closure" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
        <span>←</span>
        <span>חזרה לסגירה</span>
      </Link>

      {/* Case details card */}
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-md p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{caseKey ?? plate}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {plate}{carMake ? ` · ${carMake} ${carModel ?? ''}` : ''} · {branchName}
            </p>
          </div>
          {allDone ? (
            <span className="px-3 py-1.5 bg-green-100 text-green-800 border border-green-200 rounded-full text-sm font-semibold">
              🎉 נסגר בהצלחה
            </span>
          ) : (
            <span className="px-3 py-1.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-sm font-semibold">
              בטיפול משרדי
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {openedAt && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">תאריך פתיחה</p>
              <p className="text-sm font-semibold text-gray-700">
                {new Date(openedAt).toLocaleDateString('he-IL')}
              </p>
            </div>
          )}
          {daysOpen !== null && (
            <div className={`rounded-lg p-3 border ${daysOpen > 14 ? 'bg-red-50 border-red-100' : daysOpen > 7 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
              <p className="text-xs text-gray-400 mb-1">גיל תיק</p>
              <p className={`text-sm font-semibold ${daysOpen > 14 ? 'text-red-700' : daysOpen > 7 ? 'text-amber-700' : 'text-gray-700'}`}>
                {daysOpen} ימים
              </p>
            </div>
          )}
          {insuranceType && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">סוג ביטוח</p>
              <p className="text-sm font-semibold text-gray-700">
                {INSURANCE_TYPE_LABELS[insuranceType] ?? insuranceType}
              </p>
            </div>
          )}
          {parts && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">סטטוס חלקים</p>
              <p className={`text-sm font-semibold ${parts.color}`}>{parts.label}</p>
            </div>
          )}
          {claimNumber && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-400 mb-1">מס׳ תביעה</p>
              <p className="text-sm font-semibold text-gray-700">{claimNumber}</p>
            </div>
          )}
        </div>

        {!isCaseClosed && (blockedByExtras || blockedByApprovals || (activeStep?.step_key === 'CLOSE_CASE' && effectiveClosureApproval !== 'APPROVED')) && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
              <span>⚠️</span>
              {blockedByExtras && <span>קיימות תוספות פחחות בטיפול.</span>}
              {blockedByApprovals && <span>חסר אישור CEO לאומדן/גלגלים.</span>}
              {activeStep?.step_key === 'CLOSE_CASE' && effectiveClosureApproval !== 'APPROVED' && <span>חסר אישור CEO לסגירה.</span>}
            </p>
          </div>
        )}
      </div>

      {/* Closure checklist */}
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span>📋</span>
            צ׳קליסט סגירה
          </h2>
          <span className="text-sm text-gray-500 font-medium">
            {doneCount} / {normalizedSteps.length} הושלמו
          </span>
        </div>

        {allDone && (
          <div className="mb-5 p-4 bg-green-50 border-2 border-green-200 rounded-xl text-center">
            <div className="text-3xl mb-1">🎉</div>
            <p className="text-green-800 font-semibold">התיק נסגר בהצלחה!</p>
            <p className="text-green-600 text-sm mt-0.5">כל שלבי הסגירה הושלמו</p>
          </div>
        )}

        <ul className="space-y-3">
          {normalizedSteps.map((s, idx) => {
            const isDone = s.state === 'DONE';
            const isActive = s.state === 'ACTIVE';
            const icon = STEP_ICONS[s.step_key] ?? '•';
            const label = STEP_LABELS[s.step_key] ?? s.step_key;

            return (
              <li
                key={s.id}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                  isDone
                    ? 'bg-green-50 border-green-200'
                    : isActive
                      ? 'bg-blue-50 border-blue-300 shadow-sm'
                      : 'bg-gray-50 border-gray-100 opacity-60'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                    isDone
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isDone ? '✓' : icon}
                </div>

                <div className="flex-1">
                  <p className={`text-sm font-semibold ${isDone ? 'text-green-700 line-through' : isActive ? 'text-blue-800' : 'text-gray-500'}`}>
                    {label}
                  </p>
                  {isActive && !isDone && (
                    <p className="text-xs text-blue-500 mt-0.5">שלב נוכחי</p>
                  )}
                </div>

                <div className="flex-shrink-0">
                  {isDone && (
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium border border-green-200">
                      הושלם
                    </span>
                  )}
                  {isActive && !isDone && (
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium border border-blue-200">
                      בתהליך
                    </span>
                  )}
                  {!isDone && !isActive && (
                    <span className="text-gray-300 text-xs">שלב {idx + 1}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {canClose && activeStep && !allDone && (
          <div className="mt-5 border-t pt-5">
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={loading || (activeStep.step_key === 'CLOSE_CASE' && closeBlocked)}
                onClick={handleCompleteStep}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                  activeStep.step_key === 'CLOSE_CASE'
                    ? closeBlocked
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-md'
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                }`}
              >
                {loading
                  ? '⏳ מבצע...'
                  : activeStep.step_key === 'CLOSE_CASE'
                    ? closeBlocked
                      ? '🔒 סגירה חסומה'
                      : '🔒 סגור תיק'
                    : '✓ סמן בוצע'}
              </button>

              {activeStep.step_key === 'CLOSE_CASE' && closeBlocked && (
                <p className="text-sm text-amber-700">
                  {blockedByExtras && 'יש תוספות בטיפול. '}
                  {effectiveClosureApproval !== 'APPROVED' && 'חסר אישור CEO לסגירת תיק.'}
                </p>
              )}
              {activeStep && activeStep.step_key !== 'CLOSE_CASE' && closeBlocked && (
                <p className="text-sm text-amber-700">
                  {blockedByExtras && 'יש תוספות בטיפול. '}
                  {blockedByApprovals && 'חסר אישור CEO לאומדן/גלגלים.'}
                </p>
              )}
            </div>
            {error && (
              <p className="text-sm text-red-600 mt-3 flex items-center gap-1">
                <span>⚠️</span> {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
