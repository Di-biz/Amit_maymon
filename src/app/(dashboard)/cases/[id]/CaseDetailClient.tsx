'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { completeActiveStep, returnToEstimate } from '@/app/actions/workflow';
import type { PartsStatus } from '@/types/database';
import { PROFESSIONAL_WORKFLOW_STEPS } from '@/types/database';

const STEP_LABELS: Record<string, string> = {
  OPEN_CASE: 'פתיחת תיק',
  FIXCAR_PHOTOS: 'צילום FixCar',
  WHEELS_CHECK: 'בדיקת גלגלים',
  PREP_ESTIMATE: 'הכנת אומדן',
  SUMMARIZE_ESTIMATE: 'סיכום אומדן',
  SEND_TO_APPRAISER: 'שליחה לשמאי',
  WAIT_APPRAISER_APPROVAL: 'המתנה לאישור שמאי',
  ENTER_WORK: 'כניסה לעבודה',
  QUALITY_CONTROL: 'בקרת איכות',
  WASH: 'שטיפה',
  READY_FOR_OFFICE: 'מוכן למשרד',
};

interface CaseDetailClientProps {
  caseId: string;
  caseKey: string | null;
  claimNumber: string | null;
  plate: string;
  branchName: string;
  openedAt: string | null;
  age: string;
  partsStatus: PartsStatus;
  generalStatus: string;
  fixcarLink: string | null;
  steps: { id: string; step_key: string; state: string; order_index: number }[];
  approvals: { id: string; approval_type: string; status: string; rejection_note: string | null }[];
  extras: { id: string; description: string; status: string }[];
  auditEvents: { id: string; action: string; created_at: string; payload: unknown }[];
  role: string | null;
}

export function CaseDetailClient({
  caseId,
  plate,
  branchName,
  openedAt,
  age,
  partsStatus,
  fixcarLink,
  steps,
  approvals,
  extras,
  auditEvents,
  role,
}: CaseDetailClientProps) {
  const router = useRouter();
  const [fixcarValue, setFixcarValue] = useState(fixcarLink ?? '');
  const [partsValue, setPartsValue] = useState<PartsStatus>(partsStatus);
  const [updatingFixcar, setUpdatingFixcar] = useState(false);
  const [updatingParts, setUpdatingParts] = useState(false);
  const [completingStepId, setCompletingStepId] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);

  // CRITICAL FIX: Load steps from localStorage if server didn't load them
  const [localSteps, setLocalSteps] = useState<{ id: string; step_key: string; state: string; order_index: number }[]>(steps);
  
  const canEdit = role === 'SERVICE_MANAGER';
  const effectiveSteps = localSteps.length > 0 ? localSteps : steps;
  const activeSteps = effectiveSteps.filter((s) => s.state === 'ACTIVE').sort((a, b) => a.order_index - b.order_index);
  const activeStep = activeSteps.length > 0 ? activeSteps[0] : null; // First active step in order
  
  useEffect(() => {
    // If server didn't load steps, try to load them from localStorage
    if (steps.length === 0 && caseId) {
      console.log('[CASE DETAIL CLIENT] No steps from server, loading from localStorage...');
      const loadStepsFromLocalStorage = async () => {
        const supabase = (await import('@/lib/supabase/client')).createClient();
        
        // CRITICAL: Always clear localStorage for workflow steps to avoid corrupted data
        // The steps will be recreated fresh
        try {
          console.warn('[CASE DETAIL CLIENT] Clearing all workflow steps from localStorage to ensure fresh data...');
          localStorage.removeItem('mock_case_workflow_steps');
        } catch (e) {
          // Ignore errors
        }
        
        // Get all runs for this case
        const { data: allRuns } = await supabase
          .from('case_workflow_runs')
          .select('id')
          .eq('case_id', caseId)
          .eq('workflow_type', 'PROFESSIONAL');
        
        if (allRuns && allRuns.length > 0) {
          const runIds = allRuns.map((r) => (r as { id: string }).id);
          const { data: stepsData } = await supabase
            .from('case_workflow_steps')
            .select('id, step_key, state, order_index, completed_at')
            .in('run_id', runIds)
            .order('order_index');
          
          if (stepsData && stepsData.length > 0) {
            console.log('[CASE DETAIL CLIENT] Loaded steps from localStorage:', {
              count: stepsData.length,
              steps: stepsData.map((s: any) => ({ step_key: s.step_key, state: s.state, completed_at: s.completed_at })),
            });
            
            // CRITICAL FIX: If steps don't have step_key, they're corrupted - delete them and recreate
            const hasStepKeys = stepsData.every((s: any) => s.step_key);
            if (!hasStepKeys) {
              console.warn('[CASE DETAIL CLIENT] Steps in localStorage are corrupted (missing step_key), deleting and recreating...');
              // Delete corrupted steps from localStorage
              try {
                localStorage.removeItem('mock_case_workflow_steps');
              } catch (e) {
                // Ignore errors
              }
              // Don't return - continue to create new steps
            } else {
              // Fix any steps that are incorrectly marked as DONE
              const fixedSteps = stepsData.map((s: { id: string; step_key: string; state: string; order_index: number; completed_at?: string | null }) => {
                // If step is DONE but doesn't have completed_at (and it's not OPEN_CASE), fix it to ACTIVE
                if (s.step_key !== 'OPEN_CASE' && s.state === 'DONE' && !s.completed_at) {
                  console.log('[CASE DETAIL CLIENT] Fixing step from DONE to ACTIVE:', s.step_key);
                  return { ...s, state: 'ACTIVE', completed_at: null };
                }
                return s;
              });
              console.log('[CASE DETAIL CLIENT] Fixed steps:', fixedSteps.map(s => ({ step_key: s.step_key, state: s.state, hasLabel: !!STEP_LABELS[s.step_key] })));
              setLocalSteps(fixedSteps as { id: string; step_key: string; state: string; order_index: number }[]);
              return;
            }
          }
        }
        
        // If still no steps, create them
        console.log('[CASE DETAIL CLIENT] No steps found, attempting to create them...');
        const createSteps = async () => {
          // First, check if run exists
          const { data: runData } = await supabase
            .from('case_workflow_runs')
            .select('id')
            .eq('case_id', caseId)
            .eq('workflow_type', 'PROFESSIONAL')
            .eq('status', 'ACTIVE')
            .maybeSingle();
          
          let runId = runData?.id;
          
          // If no run, create one
          if (!runId) {
            console.log('[CASE DETAIL CLIENT] No run found, creating one...');
            const { data: newRun } = await supabase
              .from('case_workflow_runs')
              .insert({
                case_id: caseId,
                workflow_type: 'PROFESSIONAL',
                status: 'ACTIVE',
              } as never)
              .select('id')
              .single();
            if (newRun) {
              runId = (newRun as { id: string }).id;
              console.log('[CASE DETAIL CLIENT] Created run:', runId);
            }
          }
          
          // If we have a run, create steps
          if (runId) {
            console.log('[CASE DETAIL CLIENT] Creating workflow steps for run:', runId);
            const now = new Date().toISOString();
            
            const newSteps: { id: string; step_key: string; state: string; order_index: number }[] = [];
            
            for (let i = 0; i < PROFESSIONAL_WORKFLOW_STEPS.length; i++) {
              const stepKey = PROFESSIONAL_WORKFLOW_STEPS[i];
              let state: 'PENDING' | 'ACTIVE' | 'DONE' | 'SKIPPED' = 'ACTIVE';
              let completedAt: string | null = null;
              let activatedAt: string | null = now;
              
              if (stepKey === 'OPEN_CASE') {
                state = 'DONE';
                completedAt = now;
                activatedAt = now;
              } else {
                state = 'ACTIVE';
                activatedAt = now;
                completedAt = null;
              }
              
              const { data: inserted } = await supabase.from('case_workflow_steps').insert({
                run_id: runId,
                step_key: stepKey,
                state,
                order_index: i,
                activated_at: activatedAt,
                completed_at: completedAt,
              } as never).select('id, step_key, state, order_index').single();
              
              if (inserted) {
                newSteps.push(inserted as { id: string; step_key: string; state: string; order_index: number });
              }
            }
            
            console.log('[CASE DETAIL CLIENT] Created all workflow steps:', newSteps.length);
            console.log('[CASE DETAIL CLIENT] New steps details:', newSteps.map(s => ({ 
              step_key: s.step_key, 
              state: s.state, 
              order_index: s.order_index,
              hasLabel: !!STEP_LABELS[s.step_key],
              label: STEP_LABELS[s.step_key],
            })));
            setLocalSteps(newSteps);
            
            // CRITICAL: Wait a moment and then reload steps from localStorage to ensure they're saved
            setTimeout(async () => {
              const { data: reloadedSteps } = await supabase
                .from('case_workflow_steps')
                .select('id, step_key, state, order_index')
                .in('run_id', [runId])
                .order('order_index');
              
              if (reloadedSteps && reloadedSteps.length > 0) {
                console.log('[CASE DETAIL CLIENT] Reloaded steps after save:', reloadedSteps.length);
                console.log('[CASE DETAIL CLIENT] Reloaded steps details:', reloadedSteps.map((s: any) => ({ 
                  step_key: s.step_key, 
                  state: s.state, 
                  hasLabel: !!STEP_LABELS[s.step_key],
                  label: STEP_LABELS[s.step_key],
                })));
                setLocalSteps(reloadedSteps as { id: string; step_key: string; state: string; order_index: number }[]);
              }
            }, 200);
          }
        };
        
        createSteps().catch((err) => {
          console.error('[CASE DETAIL CLIENT] Error creating steps:', err);
        });
      };
      
      loadStepsFromLocalStorage();
    } else if (steps.length > 0) {
      // If server loaded steps, use them
      setLocalSteps(steps);
    }
  }, [steps.length, caseId]);
  
  // DEBUG: Log steps state
  if (typeof window !== 'undefined') {
    console.log('[CASE DETAIL CLIENT] Steps state:', {
      totalSteps: effectiveSteps.length,
      activeSteps: activeSteps.length,
      activeStep: activeStep ? { step_key: activeStep.step_key, state: activeStep.state } : null,
      steps: effectiveSteps.map(s => ({ 
        step_key: s.step_key, 
        state: s.state, 
        order_index: s.order_index,
        hasLabel: !!STEP_LABELS[s.step_key],
        label: STEP_LABELS[s.step_key],
      })),
      canEdit,
      role,
      caseId,
      fromServer: steps.length,
      fromLocal: localSteps.length,
    });
  }
  
  // Calculate progress for gamification
  const totalSteps = effectiveSteps.length;
  const completedSteps = effectiveSteps.filter((s) => s.state === 'DONE').length;
  const skippedSteps = effectiveSteps.filter((s) => s.state === 'SKIPPED').length;
  const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const points = completedSteps * 10; // 10 points per completed step

  async function saveFixcarLink() {
    if (!canEdit) return;
    setUpdatingFixcar(true);
    const supabase = (await import('@/lib/supabase/client')).createClient();
    await supabase.from('cases').update({ fixcar_link: fixcarValue || null } as never).eq('id', caseId);
    setUpdatingFixcar(false);
    router.refresh();
  }

  async function savePartsStatus() {
    if (!canEdit) return;
    setUpdatingParts(true);
    const supabase = (await import('@/lib/supabase/client')).createClient();
    await supabase.from('cases').update({ parts_status: partsValue } as never).eq('id', caseId);
    setUpdatingParts(false);
    router.refresh();
  }

  async function handleCompleteStep() {
    if (!activeStep) return;
    setStepError(null);
    setCompletingStepId(activeStep.id);
    const res = await completeActiveStep(caseId);
    setCompletingStepId(null);
    if (res?.error) setStepError(res.error);
    else router.refresh();
  }

  async function handleReturnToEstimate() {
    setReturning(true);
    const res = await returnToEstimate(caseId);
    setReturning(false);
    if (res?.error) setStepError(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      <Link href="/cases" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">
        <span>←</span>
        <span>חזרה לתיקים</span>
      </Link>

      {/* Gamification Header */}
      {canEdit && (
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold mb-1">התקדמות התיק</h3>
              <p className="text-purple-100 text-sm">ערן, המשך כך! 🎯</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{points}</div>
              <div className="text-purple-200 text-xs">נקודות</div>
            </div>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3 mb-2">
            <div 
              className="bg-white rounded-full h-3 transition-all duration-500 ease-out shadow-glow-success"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-purple-100">
            <span>{completedSteps} מתוך {totalSteps} הושלמו</span>
            <span>{progressPercentage}%</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
        <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
          <span className="text-2xl">📋</span>
          פרטי תיק
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <span className="text-gray-600 font-medium">רישוי:</span>
          <span className="font-semibold text-gray-800">{plate}</span>
          <span className="text-gray-600 font-medium">סניף:</span>
          <span className="font-semibold text-gray-800">{branchName}</span>
          <span className="text-gray-600 font-medium">נפתח:</span>
          <span className="text-gray-800">{openedAt ? new Date(openedAt).toLocaleDateString('he-IL') : '—'}</span>
          <span className="text-gray-600 font-medium">גיל רכב:</span>
          <span className="text-gray-800">{age}</span>
          <span className="text-gray-600 font-medium">חלקים:</span>
          <span className={`font-semibold ${
            partsStatus === 'AVAILABLE' ? 'text-green-600' : 
            partsStatus === 'ORDERED' ? 'text-yellow-600' : 
            'text-red-600'
          }`}>
            {partsStatus === 'AVAILABLE' ? '✅ זמינים' : 
             partsStatus === 'ORDERED' ? '⏳ הוזמנו' : 
             '❌ אין חלקים'}
          </span>
        </div>
        {canEdit && activeStep?.step_key === 'FIXCAR_PHOTOS' && (
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">קישור FixCar</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={fixcarValue}
                onChange={(e) => setFixcarValue(e.target.value)}
                onBlur={saveFixcarLink}
                className="flex-1 border rounded px-3 py-2 text-sm"
                dir="ltr"
              />
              {updatingFixcar && <span className="text-sm text-gray-500">שומר...</span>}
            </div>
          </div>
        )}
        {canEdit && (
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">סטטוס חלקים</label>
            <select
              value={partsValue}
              onChange={async (e) => {
                const v = e.target.value as PartsStatus;
                setPartsValue(v);
                setUpdatingParts(true);
                const supabase = (await import('@/lib/supabase/client')).createClient();
                await supabase.from('cases').update({ parts_status: v } as never).eq('id', caseId);
                setUpdatingParts(false);
                router.refresh();
              }}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="NO_PARTS">אין חלקים</option>
              <option value="ORDERED">הוזמנו</option>
              <option value="AVAILABLE">זמינים</option>
            </select>
            {updatingParts && <span className="mr-2 text-sm text-gray-500">שומר...</span>}
          </div>
        )}
      </div>

      {/* Checklist - Highlighted for SERVICE_MANAGER */}
      <div className={`bg-white rounded-xl shadow-md border-2 p-6 transition-all ${
        canEdit && activeStep 
          ? 'border-blue-400 shadow-glow' 
          : 'border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-2xl">✅</span>
            צ'קליסט עבודה
          </h2>
          {canEdit && activeStep && (
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold animate-pulse-slow">
              🔥 {activeSteps.length} שלבים פעילים!
            </div>
          )}
        </div>
        {effectiveSteps.length === 0 ? (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 font-medium">
              ⚠️ אין שלבים להצגה. השלבים עדיין לא נוצרו או לא נטענו.
            </p>
          </div>
        ) : (
          <>
            {canEdit && activeSteps.length === 0 && effectiveSteps.length > 0 && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">
                  🎉 כל השלבים הושלמו! התיק מוכן לסגירה.
                </p>
              </div>
            )}
            {canEdit && activeSteps.length > 1 && (
              <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <p className="text-sm text-indigo-800 font-medium">
                  💡 כל השלבים פעילים לבדיקה! "סמן בוצע" יסמן את השלב הראשון בסדר (FIXCAR_PHOTOS).
                </p>
              </div>
            )}
          </>
        )}
        <ul className="space-y-3">
          {effectiveSteps.map((s, index) => {
            // DEBUG: Log each step
            if (typeof window !== 'undefined' && index === 0) {
              console.log('[CASE DETAIL CLIENT] Rendering steps:', effectiveSteps.map(step => ({
                step_key: step.step_key,
                state: step.state,
                hasLabel: !!STEP_LABELS[step.step_key],
                label: STEP_LABELS[step.step_key],
              })));
            }
            const isActive = s.state === 'ACTIVE';
            const isDone = s.state === 'DONE';
            const isSkipped = s.state === 'SKIPPED';
            
            return (
              <li 
                key={s.id} 
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  isActive 
                    ? 'bg-blue-50 border-2 border-blue-300 shadow-md' 
                    : isDone
                      ? 'bg-green-50 border border-green-200'
                      : isSkipped
                        ? 'bg-gray-50 border border-gray-200 opacity-60'
                        : 'bg-gray-50 border border-gray-100'
                }`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  isDone
                    ? 'bg-green-500 text-white'
                    : isActive
                      ? 'bg-blue-500 text-white animate-pulse'
                      : isSkipped
                        ? 'bg-gray-300 text-gray-600'
                        : 'bg-gray-200 text-gray-500'
                }`}>
                  {isDone ? '✓' : isActive ? '→' : isSkipped ? '⊘' : index + 1}
                </div>
                <div className="flex-1">
                  <span
                    className={`text-sm font-medium ${
                      isDone
                        ? 'text-green-700 line-through'
                        : isActive
                          ? 'text-blue-700 font-bold'
                          : isSkipped
                            ? 'text-gray-400'
                            : 'text-gray-600'
                    }`}
                  >
                    {s.step_key && STEP_LABELS[s.step_key] ? STEP_LABELS[s.step_key] : s.step_key || `Step ${index + 1}`}
                  </span>
                  {/* DEBUG: Show step_key if label is missing */}
                  {s.step_key && !STEP_LABELS[s.step_key] && (
                    <span className="mr-2 text-xs text-red-500">
                      (key: {s.step_key})
                    </span>
                  )}
                  {!s.step_key && (
                    <span className="mr-2 text-xs text-red-500">
                      (NO STEP_KEY!)
                    </span>
                  )}
                  {isActive && canEdit && (
                    <span className="mr-2 text-xs text-blue-600 font-semibold">
                      ← לחץ "סמן בוצע" למטה
                    </span>
                  )}
                </div>
                {isDone && (
                  <span className="text-green-600 text-lg">🎉</span>
                )}
              </li>
            );
          })}
        </ul>
        {canEdit && activeStep && (
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
            <p className="text-sm text-gray-700 mb-3 font-medium">
              ✨ השלב הנוכחי: <span className="text-blue-700 font-bold">{STEP_LABELS[activeStep.step_key]}</span>
            </p>
            <button
              type="button"
              disabled={!!completingStepId}
              onClick={handleCompleteStep}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
            >
              {completingStepId ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>מבצע...</span>
                </>
              ) : (
                <>
                  <span>✓</span>
                  <span>סמן בוצע (+10 נקודות!)</span>
                </>
              )}
            </button>
            {stepError && (
              <p className="text-sm text-red-600 mt-3 p-2 bg-red-50 rounded border border-red-200">
                ⚠️ {stepError}
              </p>
            )}
          </div>
        )}
        {canEdit && (
          <div className="mt-2">
            <button
              type="button"
              disabled={returning}
              onClick={handleReturnToEstimate}
              className="text-sm text-amber-600 underline"
            >
              {returning ? '...' : 'החזר לאומדן'}
            </button>
          </div>
        )}
      </div>

      {approvals.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            <span className="text-2xl">👔</span>
            אישורי עמית
          </h2>
          <ul className="space-y-2">
            {approvals.map((a) => (
              <li 
                key={a.id} 
                className={`p-3 rounded-lg border ${
                  a.status === 'APPROVED' 
                    ? 'bg-green-50 border-green-200' 
                    : a.status === 'REJECTED'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className={`font-semibold ${
                    a.status === 'APPROVED' ? 'text-green-700' : 
                    a.status === 'REJECTED' ? 'text-red-700' : 
                    'text-yellow-700'
                  }`}>
                    {a.status === 'APPROVED' ? '✅' : a.status === 'REJECTED' ? '❌' : '⏳'} 
                    {a.approval_type}
                  </span>
                  <span className="text-gray-600">— {a.status}</span>
                </div>
                {a.rejection_note && (
                  <p className="text-xs text-red-600 mt-1 mr-4">💬 {a.rejection_note}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {extras.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            <span className="text-2xl">🔧</span>
            תוספות
          </h2>
          <ul className="space-y-2">
            {extras.map((e) => (
              <li 
                key={e.id} 
                className={`p-3 rounded-lg border text-sm ${
                  e.status === 'DONE' 
                    ? 'bg-green-50 border-green-200' 
                    : e.status === 'IN_TREATMENT'
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-red-50 border-red-200'
                }`}
              >
                <span className="font-medium text-gray-800">{e.description}</span>
                <span className={`mr-2 font-semibold ${
                  e.status === 'DONE' ? 'text-green-600' : 
                  e.status === 'IN_TREATMENT' ? 'text-blue-600' : 
                  'text-red-600'
                }`}>
                  — {e.status === 'DONE' ? '✅ הושלם' : e.status === 'IN_TREATMENT' ? '🔨 בטיפול' : '❌ נדחה'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
          <span className="text-2xl">📊</span>
          ציר זמן (אודיט)
        </h2>
        <ul className="space-y-2">
          {auditEvents.map((e) => (
            <li key={e.id} className="p-2 text-sm text-gray-600 border-r-2 border-blue-300 pr-3">
              <span className="font-medium text-gray-800">
                {new Date(e.created_at).toLocaleString('he-IL')}
              </span>
              <span className="mr-2">—</span>
              <span>{e.action}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
