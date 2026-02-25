'use client';

import { useEffect, useState } from 'react';

type PreviewRole = 'SERVICE_MANAGER' | 'CEO' | 'OFFICE';

const ROLES: { role: PreviewRole; name: string; label: string; emoji: string }[] = [
  { role: 'SERVICE_MANAGER', name: 'ערן', label: 'מנהל שירות', emoji: '🔧' },
  { role: 'CEO',             name: 'עמית', label: 'מנכ"ל',      emoji: '👔' },
  { role: 'OFFICE',          name: 'אילנה', label: 'משרד',      emoji: '📋' },
];

export function PreviewRoleSwitcher() {
  const [activeRole, setActiveRole] = useState<PreviewRole>('SERVICE_MANAGER');

  useEffect(() => {
    const stored = localStorage.getItem('preview_active_role') as PreviewRole | null;
    if (stored && ROLES.some((r) => r.role === stored)) {
      setActiveRole(stored);
    }
  }, []);

  function switchRole(role: PreviewRole) {
    localStorage.setItem('preview_active_role', role);
    window.location.reload();
  }

  const current = ROLES.find((r) => r.role === activeRole) ?? ROLES[0];

  return (
    <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-2 flex items-center justify-between text-sm">
      <span className="text-indigo-700 font-medium">
        {current.emoji} מחובר כ: <strong>{current.name}</strong> ({current.label})
      </span>
      <div className="flex gap-2">
        <span className="text-indigo-500 text-xs ml-2">החלף משתמש:</span>
        {ROLES.map((r) => (
          <button
            key={r.role}
            onClick={() => switchRole(r.role)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              r.role === activeRole
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-white text-indigo-700 border border-indigo-300 hover:bg-indigo-100'
            }`}
          >
            {r.emoji} {r.name}
          </button>
        ))}
      </div>
    </div>
  );
}
