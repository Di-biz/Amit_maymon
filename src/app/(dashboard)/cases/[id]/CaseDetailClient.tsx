'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { completeActiveStep, returnToEstimate } from '@/app/actions/workflow';
import type { Case, PartsStatus } from '@/types/database';

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

  const canEdit = role === 'SERVICE_MANAGER';
  const activeStep = steps.find((s) => s.state === 'ACTIVE');

  async function saveFixcarLink() {
    if (!canEdit) return;
    setUpdatingFixcar(true);
    const supabase = (await import('@/lib/supabase/client')).createClient();
    await supabase.from('cases').update({ fixcar_link: fixcarValue || null } as Partial<Case>).eq('id', caseId);
    setUpdatingFixcar(false);
    router.refresh();
  }

  async function savePartsStatus() {
    if (!canEdit) return;
    setUpdatingParts(true);
    const supabase = (await import('@/lib/supabase/client')).createClient();
    await supabase.from('cases').update({ parts_status: partsValue } as Partial<Case>).eq('id', caseId);
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
      <Link href="/cases" className="text-blue-600 text-sm underline">
        ← חזרה לתיקים
      </Link>

      <div className="bg-white rounded border border-gray-200 p-4">
        <h2 className="font-bold mb-2">פרטי תיק</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-gray-500">רישוי:</span>
          <span>{plate}</span>
          <span className="text-gray-500">סניף:</span>
          <span>{branchName}</span>
          <span className="text-gray-500">נפתח:</span>
          <span>{openedAt ? new Date(openedAt).toLocaleDateString('he-IL') : '—'}</span>
          <span className="text-gray-500">גיל רכב:</span>
          <span>{age}</span>
          <span className="text-gray-500">חלקים:</span>
          <span>{partsStatus}</span>
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
                await supabase.from('cases').update({ parts_status: v } as Partial<Case>).eq('id', caseId);
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

      <div className="bg-white rounded border border-gray-200 p-4">
        <h2 className="font-bold mb-2">צ'קליסט</h2>
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <span
                className={
                  s.state === 'DONE'
                    ? 'text-green-600'
                    : s.state === 'SKIPPED'
                      ? 'text-gray-400'
                      : s.state === 'ACTIVE'
                        ? 'font-medium'
                        : 'text-gray-500'
                }
              >
                {STEP_LABELS[s.step_key] ?? s.step_key}
              </span>
              <span className="text-gray-400">({s.state})</span>
            </li>
          ))}
        </ul>
        {canEdit && activeStep && (
          <div className="mt-3">
            <button
              type="button"
              disabled={!!completingStepId}
              onClick={handleCompleteStep}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
            >
              {completingStepId ? 'מבצע...' : 'סמן בוצע'}
            </button>
            {stepError && <p className="text-sm text-red-600 mt-2">{stepError}</p>}
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
        <div className="bg-white rounded border border-gray-200 p-4">
          <h2 className="font-bold mb-2">אישורי עמית</h2>
          <ul className="space-y-1 text-sm">
            {approvals.map((a) => (
              <li key={a.id}>
                {a.approval_type}: {a.status}
                {a.rejection_note && ` — ${a.rejection_note}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {extras.length > 0 && (
        <div className="bg-white rounded border border-gray-200 p-4">
          <h2 className="font-bold mb-2">תוספות</h2>
          <ul className="space-y-1 text-sm">
            {extras.map((e) => (
              <li key={e.id}>
                {e.description} — {e.status}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded border border-gray-200 p-4">
        <h2 className="font-bold mb-2">ציר זמן (אודיט)</h2>
        <ul className="space-y-1 text-sm text-gray-600">
          {auditEvents.map((e) => (
            <li key={e.id}>
              {new Date(e.created_at).toLocaleString('he-IL')} — {e.action}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
