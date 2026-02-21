'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { completeActiveStep } from '@/app/actions/workflow';

const STEP_LABELS: Record<string, string> = {
  CLOSURE_VERIFY_DETAILS_DOCS: 'אימות פרטים ומסמכים',
  CLOSURE_PROFORMA_IF_NEEDED: 'פרופורמה במידת הצורך',
  CLOSURE_PREPARE_CLOSING_FORMS: 'הכנת טפסי סגירה',
  CLOSE_CASE: 'סגירת תיק',
};

interface ClosureDetailClientProps {
  caseId: string;
  caseKey: string | null;
  plate: string;
  steps: { id: string; step_key: string; state: string; order_index: number }[];
  blockedByExtras: boolean;
  blockedByApprovals: boolean;
  canClose: boolean;
}

export function ClosureDetailClient({
  caseId,
  caseKey,
  plate,
  steps,
  blockedByExtras,
  blockedByApprovals,
  canClose,
}: ClosureDetailClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeStep = steps.find((s) => s.state === 'ACTIVE');
  const closeBlocked = blockedByExtras || blockedByApprovals;

  async function handleCompleteStep() {
    if (!activeStep) return;
    setError(null);
    setLoading(true);
    const res = await completeActiveStep(caseId);
    setLoading(false);
    if (res?.error) setError(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      <Link href="/closure" className="text-blue-600 text-sm underline">
        ← חזרה לסגירה
      </Link>

      <div className="bg-white rounded border p-4">
        <h2 className="font-bold mb-2">תיק: {caseKey ?? plate}</h2>
        {(blockedByExtras || blockedByApprovals) && (
          <div className="text-sm text-amber-600 mb-2">
            {blockedByExtras && 'תוספות בטיפול. '}
            {blockedByApprovals && 'חסר אישור עמית.'}
          </div>
        )}
      </div>

      <div className="bg-white rounded border p-4">
        <h2 className="font-bold mb-2">צ'קליסט סגירה</h2>
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <span
                className={
                  s.state === 'DONE' ? 'text-green-600' : s.state === 'ACTIVE' ? 'font-medium' : 'text-gray-500'
                }
              >
                {STEP_LABELS[s.step_key] ?? s.step_key}
              </span>
              <span className="text-gray-400">({s.state})</span>
            </li>
          ))}
        </ul>
        {canClose && activeStep && (
          <div className="mt-3">
            <button
              type="button"
              disabled={loading || (activeStep.step_key === 'CLOSE_CASE' && closeBlocked)}
              onClick={handleCompleteStep}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
            >
              {loading ? 'מבצע...' : activeStep.step_key === 'CLOSE_CASE' ? 'סגור תיק' : 'סמן בוצע'}
            </button>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
