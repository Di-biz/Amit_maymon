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
  const canEdit = role === 'SERVICE_MANAGER';

  const [partsValue, setPartsValue] = useState<PartsStatus>(partsStatus);
  const [fixcarValue, setFixcarValue] = useState(fixcarLink ?? '');
  const [updatingParts, setUpdatingParts] = useState(false);

  const [localSteps, setLocalSteps] = useState<StepRow[]>(steps);
  const effectiveSteps = localSteps.length > 0 ? localSteps : steps;

  const [completingStepId, setCompletingStepId] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [editingLinkStepId, setEditingLinkStepId] = useState<string | null>(null);
  const [stepLinks, setStepLinks] = useState<Record<string, string>>({});
  const [returning, setReturning] = useState(false);

  const initRef = useRef<string | null>(null);

  // Seed stepLinks from existing fixcarLink when we know the step id.
  useEffect(() => {
    if (!fixcarLink) return;
    const step = effectiveSteps.find((s) => s.step_key === 'FIXCAR_PHOTOS');
    if (!step) return;
    setStepLinks((prev) => ({ ...prev, [step.id]: fixcarLink }));
  }, [fixcarLink, effectiveSteps]);

  // In PREVIEW mode, server-rendered steps may be empty; load them client-side (from localStorage via mock client).
  useEffect(() => {
    if (!isPreview) return;
    if (steps.length > 0) return;
    if (!caseId) return;
    if (initRef.current === caseId) return;
    initRef.current = caseId;

    (async () => {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data: runs } = await supabase
        .from('case_workflow_runs')
        .select('id')
        .eq('case_id', caseId)
        .eq('workflow_type', 'PROFESSIONAL');
      const runIds = (runs as { id: string }[] | null)?.map((r) => r.id) ?? [];
      if (runIds.length === 0) return;

      const { data: stepsData } = await supabase
        .from('case_workflow_steps')
        .select('id, step_key, state, order_index, completed_at')
        .in('run_id', runIds)
        .order('order_index');

      if (stepsData && stepsData.length > 0) {
        const rows = stepsData as unknown as StepRow[];
        // If corrupted (missing step_key), clear and let other logic recreate.
        if (!rows.every((s) => !!s.step_key)) {
          try {
            localStorage.removeItem('mock_case_workflow_steps');
          } catch {
            // ignore
          }
          return;
        }
        setLocalSteps(rows);
      }
    })().catch((e) => {
      console.error('[CaseDetailClientV2] Failed to load steps in preview:', e);
    });
  }, [isPreview, steps.length, caseId]);

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
        .eq('workflow_type', 'PROFESSIONAL');
      const runIds = (runs as { id: string }[] | null)?.map((r) => r.id) ?? [];
      if (runIds.length === 0) return;

      const { data: stepsData } = await supabase
        .from('case_workflow_steps')
        .select('id, step_key, state, order_index, completed_at')
        .in('run_id', runIds)
        .order('order_index');

      if (stepsData && stepsData.length > 0) {
        setLocalSteps(stepsData as unknown as StepRow[]);
      }
    };

    const timer = setTimeout(() => {
      reloadSteps().catch(console.error);
    }, 500);

    return () => clearTimeout(timer);
  }, [isPreview, caseId, completingStepId]);

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
    const supabase = (await import('@/lib/supabase/client')).createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id ?? null;
    const now = new Date().toISOString();

    if (step.step_key === 'FIXCAR_PHOTOS') {
      const toSave = (link ?? '').trim();
      await supabase.from('cases').update({ fixcar_link: toSave || null } as never).eq('id', caseId);
      setFixcarValue(toSave);
      // Update stepLinks to persist the link
      setStepLinks((prev) => ({ ...prev, [step.id]: toSave }));
    }

    const { data: stepMeta } = await supabase
      .from('case_workflow_steps')
      .select('run_id')
      .eq('id', step.id)
      .single();
    const runId = (stepMeta as { run_id?: string } | null)?.run_id;

    await supabase
      .from('case_workflow_steps')
      .update({ state: 'DONE', completed_at: now, completed_by: userId } as never)
      .eq('id', step.id);

    await supabase.from('audit_events').insert(
      {
        entity_type: 'WORKFLOW_STEP',
        entity_id: step.id,
        action: 'STEP_COMPLETED',
        user_id: userId,
        payload: { step_key: step.step_key },
      } as never
    );

    if (runId) {
      const { data: updated } = await supabase
        .from('case_workflow_steps')
        .select('id, step_key, state, order_index, completed_at')
        .eq('run_id', runId)
        .order('order_index');
      if (updated) setLocalSteps(updated as unknown as StepRow[]);
    } else {
      setLocalSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, state: 'DONE', completed_at: now } : s)));
    }
  }

  async function handleComplete(step: StepRow) {
    if (!canEdit) return;
    setStepError(null);

    // Check blocking rules before completion
    if (step.step_key === 'FIXCAR_PHOTOS') {
      const link = (stepLinks[step.id] ?? fixcarValue ?? '').trim();
      if (!link) {
        setEditingLinkStepId(step.id);
        setStepError('נדרש קישור FixCar להשלמת השלב');
        return;
      }
    }

    if (step.step_key === 'ENTER_WORK' && partsStatus !== 'AVAILABLE') {
      setStepError('לא ניתן להיכנס לעבודה - סטטוס חלקים חייב להיות "זמינים"');
      return;
    }

    if (step.step_key === 'READY_FOR_OFFICE') {
      const hasExtrasInTreatment = extras.some((e) => e.status === 'IN_TREATMENT');
      if (hasExtrasInTreatment) {
        setStepError('לא ניתן להשלים - יש תוספות פחחות בטיפול');
        return;
      }
      const requiredApprovals = approvals.filter((a) => a.approval_type === 'ESTIMATE_AND_DETAILS' || a.approval_type === 'WHEELS_CHECK');
      const hasRejectedOrMissing = requiredApprovals.some((a) => a.status !== 'APPROVED');
      if (hasRejectedOrMissing) {
        setStepError('לא ניתן להשלים - נדרש אישור CEO');
        return;
      }
    }

    const requiresLink = STEPS_REQUIRING_LINK.has(step.step_key);
    const link = (stepLinks[step.id] ?? (step.step_key === 'FIXCAR_PHOTOS' ? fixcarValue : '')).trim();
    if (requiresLink && !link) {
      setEditingLinkStepId(step.id);
      return;
    }

    setCompletingStepId(step.id);
    try {
      if (isPreview) {
        await completePreview(step, link);
      } else {
        const res = await completeActiveStep(caseId, step.id);
        if (res?.error) {
          setStepError(res.error);
        } else {
          // Refresh to get updated steps
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

  async function handleSaveLinkAndComplete(step: StepRow) {
    const link = (stepLinks[step.id] ?? '').trim();
    if (!link) {
      setStepError('נדרש קישור');
      return;
    }
    setEditingLinkStepId(null);
    await handleComplete(step);
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

              // Check if step is blocked
              let isBlocked = false;
              let blockReason = '';
              if (!isDone && !isSkipped) {
                if (s.step_key === 'FIXCAR_PHOTOS' && !hasLink) {
                  isBlocked = true;
                  blockReason = 'נדרש קישור';
                } else if (s.step_key === 'ENTER_WORK' && partsStatus !== 'AVAILABLE') {
                  isBlocked = true;
                  blockReason = 'חלקים לא זמינים';
                } else if (s.step_key === 'READY_FOR_OFFICE') {
                  const hasExtrasInTreatment = extras.some((e) => e.status === 'IN_TREATMENT');
                  const requiredApprovals = approvals.filter((a) => a.approval_type === 'ESTIMATE_AND_DETAILS' || a.approval_type === 'WHEELS_CHECK');
                  const hasRejectedOrMissing = requiredApprovals.some((a) => a.status !== 'APPROVED');
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
                        disabled={!!completingStepId || isBlocked}
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
                    <div className="mr-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <label className="block text-sm font-medium mb-2">קישור ל-{label}</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={stepLinks[s.id] ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setStepLinks((prev) => ({ ...prev, [s.id]: v }));
                            if (s.step_key === 'FIXCAR_PHOTOS') setFixcarValue(v);
                          }}
                          className="flex-1 border rounded px-3 py-2 text-sm"
                          dir="ltr"
                          placeholder="הכנס קישור..."
                        />
                        <button
                          type="button"
                          disabled={!!completingStepId}
                          onClick={() => void handleSaveLinkAndComplete(s)}
                          className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {completingStepId === s.id ? 'מבצע...' : 'שמור וסמן בוצע'}
                        </button>
                        <button type="button" onClick={() => setEditingLinkStepId(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300">
                          ביטול
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
