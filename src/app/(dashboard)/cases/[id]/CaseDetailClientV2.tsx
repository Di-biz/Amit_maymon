'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { completeActiveStep, returnToEstimate } from '@/app/actions/workflow';
import type { PartsStatus } from '@/types/database';

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

const STEPS_REQUIRING_LINK = new Set(['FIXCAR_PHOTOS']);

type StepRow = { id: string; step_key: string; state: string; order_index: number; completed_at?: string | null };

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
  steps: StepRow[];
  approvals: { id: string; approval_type: string; status: string; rejection_note: string | null }[];
  extras: { id: string; description: string; status: string }[];
  auditEvents: { id: string; action: string; created_at: string; payload: unknown }[];
  role: string | null;
}

export function CaseDetailClientV2(props: CaseDetailClientProps) {
  const {
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
  } = props;

  const router = useRouter();
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';
  // In PREVIEW: role comes from server (always SERVICE_MANAGER). Read active role from localStorage for UI.
  const [activePreviewRole, setActivePreviewRole] = useState<string>(role ?? 'SERVICE_MANAGER');
  const canEdit = isPreview ? activePreviewRole === 'SERVICE_MANAGER' : role === 'SERVICE_MANAGER';

  const [partsValue, setPartsValue] = useState<PartsStatus>(partsStatus);
  const [fixcarValue, setFixcarValue] = useState(fixcarLink ?? '');
  const [updatingParts, setUpdatingParts] = useState(false);

  // Keep a local copy of steps so we can update the UI immediately when completing steps.
  // In PREVIEW mode the server already uses the mock client, so `steps` are always in sync
  // with the mock DB and persist across reloads.
  const [localSteps, setLocalSteps] = useState<StepRow[]>(steps);
  const effectiveSteps = localSteps;

  // Approvals from localStorage in PREVIEW (server-rendered data is stale)
  type ApprovalRow = { id: string; approval_type: string; status: string; rejection_note: string | null };
  const [localApprovals, setLocalApprovals] = useState<ApprovalRow[]>(isPreview ? [] : approvals);
  const effectiveApprovals = isPreview ? localApprovals : approvals;

  const [completingStepId, setCompletingStepId] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [editingLinkStepId, setEditingLinkStepId] = useState<string | null>(null);
  const [stepLinks, setStepLinks] = useState<Record<string, string>>({});
  const [returning, setReturning] = useState(false);

  const initRef = useRef<string | null>(null);
  const approvalsInitRef = useRef<string | null>(null);

  // Read active preview role from localStorage
  useEffect(() => {
    if (!isPreview) return;
    const stored = localStorage.getItem('preview_active_role');
    if (stored) setActivePreviewRole(stored);
  }, [isPreview]);

  // Seed stepLinks from existing fixcarLink when we know the step id.
  useEffect(() => {
    if (!fixcarLink) return;
    const step = effectiveSteps.find((s) => s.step_key === 'FIXCAR_PHOTOS');
    if (!step) return;
    setStepLinks((prev) => ({ ...prev, [step.id]: fixcarLink }));
  }, [fixcarLink, effectiveSteps]);

  // Load approvals from localStorage in PREVIEW (server-rendered data is always stale)
  useEffect(() => {
    if (!isPreview) return;
    if (!caseId) return;
    if (approvalsInitRef.current === caseId) return;
    approvalsInitRef.current = caseId;

    (async () => {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data } = await supabase
        .from('ceo_approvals')
        .select('id, approval_type, status, rejection_note')
        .eq('case_id', caseId);
      if (data) setLocalApprovals(data as ApprovalRow[]);
    })().catch(console.error);
  }, [isPreview, caseId]);

  // Keep local steps in sync if the server props change (e.g. after navigation).
  useEffect(() => {
    setLocalSteps(steps);
  }, [steps]);

  const orderedSteps = useMemo(
    () => [...effectiveSteps].sort((a, b) => a.order_index - b.order_index),
    [effectiveSteps]
  );

  // Build timeline from audit events and completed steps
  const timeline = useMemo(() => {
    const items: Array<{
      id: string;
      action: string;
      stepKey?: string;
      stepLabel: string;
      timestamp: string;
      type: 'step' | 'case';
    }> = [];

    // Add step completions from audit events
    auditEvents
      .filter((e) => e.action === 'STEP_COMPLETED')
      .forEach((e) => {
        const payload = e.payload as { step_key?: string } | null;
        const stepKey = payload?.step_key;
        const stepLabel = stepKey ? STEP_LABELS[stepKey] ?? stepKey : 'שלב לא ידוע';
        items.push({
          id: e.id,
          action: 'STEP_COMPLETED',
          stepKey,
          stepLabel: `הושלם: ${stepLabel}`,
          timestamp: e.created_at,
          type: 'step',
        });
      });

    // Also add completed steps from localSteps that have completed_at
    effectiveSteps
      .filter((s) => s.state === 'DONE' && s.completed_at)
      .forEach((s) => {
        const stepLabel = STEP_LABELS[s.step_key] ?? s.step_key;
        // Only add if not already in timeline from audit events
        if (!items.some((item) => item.stepKey === s.step_key && item.action === 'STEP_COMPLETED')) {
          items.push({
            id: `step-${s.id}`,
            action: 'STEP_COMPLETED',
            stepKey: s.step_key,
            stepLabel: `הושלם: ${stepLabel}`,
            timestamp: s.completed_at!,
            type: 'step',
          });
        }
      });

    // Add case creation if available
    if (openedAt) {
      items.push({
        id: 'case-opened',
        action: 'CASE_CREATED',
        stepLabel: 'תיק נפתח',
        timestamp: openedAt,
        type: 'case',
      });
    }

    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditEvents, effectiveSteps, openedAt]);

  async function savePartsStatus(v: PartsStatus) {
    if (!canEdit) return;
    setPartsValue(v);
    setUpdatingParts(true);
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      await supabase.from('cases').update({ parts_status: v } as never).eq('id', caseId);
      router.refresh();
    } finally {
      setUpdatingParts(false);
    }
  }

  async function completePreview(step: StepRow, link?: string) {
    // DEBUG: track when preview completion is triggered
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.log('[CaseDetailClientV2] completePreview()', {
        stepId: step.id,
        stepKey: step.step_key,
        currentState: step.state,
      });
    }

    const supabase = (await import('@/lib/supabase/client')).createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id ?? null;
    const now = new Date().toISOString();

    // 1) Persist FixCar link if relevant
    if (step.step_key === 'FIXCAR_PHOTOS') {
      const toSave = (link ?? '').trim();
      await supabase.from('cases').update({ fixcar_link: toSave || null } as never).eq('id', caseId);
      setFixcarValue(toSave);
      // Update stepLinks to persist the link
      setStepLinks((prev) => ({ ...prev, [step.id]: toSave }));
    }

    // 2) Load run id for audit / run completion logic
    const { data: stepMeta } = await supabase
      .from('case_workflow_steps')
      .select('run_id')
      .eq('id', step.id)
      .single();
    const runId = (stepMeta as { run_id?: string } | null)?.run_id ?? null;

    // 3) Mark the current step as DONE in the mock DB
    await supabase
      .from('case_workflow_steps')
      .update({ state: 'DONE', completed_at: now, completed_by: userId } as never)
      .eq('id', step.id);

    // 4) Activate the next PENDING step in the mock DB (if any)
    const nextStep = orderedSteps.find(
      (s) => s.order_index === step.order_index + 1 && s.state === 'PENDING'
    );
    if (nextStep) {
      await supabase
        .from('case_workflow_steps')
        .update({ state: 'ACTIVE', activated_at: now } as never)
        .eq('id', nextStep.id);
    }

    // 5) In preview we also mirror the change immediately into local state,
    //    so the UI always updates even if mock persistence has quirks.
    setLocalSteps((prev) =>
      prev.map((s) => {
        if (s.id === step.id) {
          return { ...s, state: 'DONE', completed_at: now };
        }
        if (nextStep && s.id === nextStep.id) {
          return { ...s, state: 'ACTIVE', /* keep existing completed_at, but ensure activated_at is set */ };
        }
        return s;
      })
    );

    // 6) Special: READY_FOR_OFFICE marks the professional run as COMPLETED
    if (step.step_key === 'READY_FOR_OFFICE' && runId) {
      await supabase
        .from('case_workflow_runs')
        .update({ status: 'COMPLETED' } as never)
        .eq('id', runId);
      await supabase
        .from('cases')
        .update({ treatment_finished_at: now } as never)
        .eq('id', caseId);
    }

    // 7) Write audit event so the timeline stays correct
    await supabase.from('audit_events').insert(
      {
        entity_type: 'WORKFLOW_STEP',
        entity_id: step.id,
        action: 'STEP_COMPLETED',
        user_id: userId,
        payload: { step_key: step.step_key },
      } as never
    );
  }

  // Core completion logic — called after all validations pass
  async function performComplete(step: StepRow, link?: string) {
    setCompletingStepId(step.id);
    try {
      if (isPreview) {
        await completePreview(step, link);
      } else {
        const res = await completeActiveStep(caseId, step.id);
        if (res?.error) {
          setStepError(res.error);
        } else {
          router.refresh();
        }
      }
    } catch (e) {
      console.error('[CaseDetailClientV2] complete failed:', e);
      setStepError('שגיאה בהשלמת השלב');
    } finally {
      setCompletingStepId(null);
    }
  }

  async function handleComplete(step: StepRow) {
    if (!canEdit) return;
    setStepError(null);

    // Steps requiring a link: always open the popup first (pre-fill if link exists)
    if (STEPS_REQUIRING_LINK.has(step.step_key)) {
      if (!stepLinks[step.id] && step.step_key === 'FIXCAR_PHOTOS' && fixcarValue) {
        setStepLinks((prev) => ({ ...prev, [step.id]: fixcarValue }));
      }
      setEditingLinkStepId(step.id);
      return;
    }

    // Real blockers (cannot be resolved inline)
    if (step.step_key === 'ENTER_WORK' && partsStatus !== 'AVAILABLE') {
      setStepError('לא ניתן להיכנס לעבודה - סטטוס חלקים חייב להיות "זמינים"');
      return;
    }

    if (step.step_key === 'READY_FOR_OFFICE') {
      if (extras.some((e) => e.status === 'IN_TREATMENT')) {
        setStepError('לא ניתן להשלים - יש תוספות פחחות בטיפול');
        return;
      }
      const required = effectiveApprovals.filter((a) => a.approval_type === 'ESTIMATE_AND_DETAILS' || a.approval_type === 'WHEELS_CHECK');
      if (required.length > 0 && required.some((a) => a.status !== 'APPROVED')) {
        setStepError('לא ניתן להשלים - נדרש אישור CEO (עמית)');
        return;
      }
    }

    await performComplete(step);
  }

  // Called from popup confirm button — validate link then complete directly (no popup re-open)
  async function handleSaveLinkAndComplete(step: StepRow) {
    const link = (stepLinks[step.id] ?? '').trim();
    if (!link) {
      setStepError('נדרש קישור');
      return;
    }
    setStepError(null);
    setEditingLinkStepId(null);
    await performComplete(step, link);
  }

  async function handleReturnToEstimate() {
    setReturning(true);
    try {
      const res = await returnToEstimate(caseId);
      if (res?.error) setStepError(res.error);
      else router.refresh();
    } finally {
      setReturning(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/cases" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
        <span>←</span>
        <span>חזרה לתיקים</span>
      </Link>

      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
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
        </div>

        {canEdit && (
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">סטטוס חלקים</label>
            <select
              value={partsValue}
              onChange={(e) => void savePartsStatus(e.target.value as PartsStatus)}
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

      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-2xl">✅</span>
            צ'קליסט עבודה
          </h2>
        </div>

        {orderedSteps.length === 0 ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800 font-medium">⚠️ אין שלבים להצגה</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {orderedSteps.map((s, index) => {
              const isDone = s.state === 'DONE';
              const isSkipped = s.state === 'SKIPPED';
              const isActive = s.state === 'ACTIVE';
              const label = STEP_LABELS[s.step_key] ?? s.step_key ?? `Step ${index + 1}`;
              const savedLink = stepLinks[s.id] || (s.step_key === 'FIXCAR_PHOTOS' ? fixcarValue : '');
              const hasLink = savedLink.trim().length > 0;

              // Check if step is blocked by a real blocker (not link — link uses popup)
              let isBlocked = false;
              let blockReason = '';
              if (!isDone && !isSkipped) {
                if (s.step_key === 'ENTER_WORK' && partsStatus !== 'AVAILABLE') {
                  isBlocked = true;
                  blockReason = 'חלקים לא זמינים';
                } else if (s.step_key === 'READY_FOR_OFFICE') {
                  const hasExtrasInTreatment = extras.some((e) => e.status === 'IN_TREATMENT');
                  const requiredApprovals = effectiveApprovals.filter((a) => a.approval_type === 'ESTIMATE_AND_DETAILS' || a.approval_type === 'WHEELS_CHECK');
                  const hasRejectedOrMissing = requiredApprovals.length > 0 && requiredApprovals.some((a) => a.status !== 'APPROVED');
                  if (hasExtrasInTreatment || hasRejectedOrMissing) {
                    isBlocked = true;
                    if (hasExtrasInTreatment) blockReason = 'תוספות בטיפול';
                    else if (hasRejectedOrMissing) blockReason = 'נדרש אישור CEO';
                  }
                }
              }

              return (
                <li key={s.id} className="space-y-2">
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      isActive
                        ? isBlocked
                          ? 'bg-yellow-50 border-yellow-300'
                          : 'bg-blue-50 border-blue-300'
                        : isDone
                          ? 'bg-green-50 border-green-200'
                          : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        isDone ? 'bg-green-500 text-white' : isActive ? (isBlocked ? 'bg-yellow-500 text-white' : 'bg-blue-500 text-white') : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isDone ? '✓' : isBlocked ? '⚠' : index + 1}
                    </div>
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${isDone ? 'text-green-700 line-through' : isBlocked ? 'text-yellow-800' : 'text-gray-700'}`}>
                        {label}
                      </span>
                      {isBlocked && blockReason && (
                        <span className="mr-2 text-xs text-yellow-700 font-normal">({blockReason})</span>
                      )}
                    </div>

                    {canEdit && !isDone && !isSkipped && (
                      <button
                        type="button"
                        disabled={!!completingStepId || (isBlocked && !STEPS_REQUIRING_LINK.has(s.step_key))}
                        onClick={() => void handleComplete(s)}
                        className={`px-3 py-1 rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                          isBlocked
                            ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                        title={isBlocked ? blockReason : undefined}
                      >
                        {completingStepId === s.id ? 'מבצע...' : isBlocked ? 'חסום' : 'סמן בוצע'}
                      </button>
                    )}
                  </div>

                  {/* Display saved link below step */}
                  {isDone && hasLink && s.step_key === 'FIXCAR_PHOTOS' && (
                    <div className="mr-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600">קישור:</span>
                        <a
                          href={savedLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-700 underline truncate flex-1"
                          dir="ltr"
                        >
                          {savedLink}
                        </a>
                      </div>
                    </div>
                  )}

                  {canEdit && editingLinkStepId === s.id && STEPS_REQUIRING_LINK.has(s.step_key) && !isDone && !isSkipped && (
                    <div className="mr-11 mt-1 p-3 bg-white rounded-lg border border-blue-300 shadow-md">
                      <p className="text-xs font-semibold text-blue-700 mb-2">
                        🔗 הוסף קישור ל-{label}
                      </p>
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          type="url"
                          value={stepLinks[s.id] ?? (s.step_key === 'FIXCAR_PHOTOS' ? fixcarValue : '')}
                          onChange={(e) => {
                            const v = e.target.value;
                            setStepLinks((prev) => ({ ...prev, [s.id]: v }));
                            if (s.step_key === 'FIXCAR_PHOTOS') setFixcarValue(v);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleSaveLinkAndComplete(s);
                            if (e.key === 'Escape') setEditingLinkStepId(null);
                          }}
                          className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          dir="ltr"
                          placeholder="https://..."
                        />
                        <button
                          type="button"
                          disabled={!!completingStepId}
                          onClick={() => void handleSaveLinkAndComplete(s)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                        >
                          {completingStepId === s.id ? <span>⏳</span> : '✓ אישור'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingLinkStepId(null)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-md text-xs font-semibold hover:bg-gray-200"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {stepError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">⚠️ {stepError}</p>
          </div>
        )}

        {canEdit && (
          <div className="mt-2">
            <button type="button" disabled={returning} onClick={() => void handleReturnToEstimate()} className="text-sm text-amber-600 underline">
              {returning ? '...' : 'החזר לאומדן'}
            </button>
          </div>
        )}
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            <span className="text-2xl">⏱️</span>
            ציר זמן
          </h2>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute right-6 top-0 bottom-0 w-0.5 bg-blue-200" />
            <div className="space-y-4">
              {timeline.map((item, idx) => (
                <div key={item.id} className="relative flex items-start gap-4 pr-6">
                  {/* Timeline dot */}
                  <div
                    className={`flex-shrink-0 w-4 h-4 rounded-full mt-1 z-10 ${
                      item.type === 'case' ? 'bg-blue-500' : 'bg-green-500'
                    }`}
                  />
                  {/* Content */}
                  <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-800">{item.stepLabel}</div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                          <span>🕐</span>
                          <span>
                            {new Date(item.timestamp).toLocaleString('he-IL', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                      {item.type === 'step' && (
                        <div className="flex-shrink-0">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ הושלם
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
