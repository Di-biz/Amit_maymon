'use client';

import { markRead, markAllRead } from '@/app/actions/notifications';

interface NotificationRow {
  id: string;
  type: string | null;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, string> = {
  APPROVAL_REQUIRED: '✅',
  BLOCKER: '⚠️',
  WORKFLOW: '📋',
  CASE_CLOSED: '🏁',
  PARTS_UPDATE: '📦',
};

function getTypeIcon(type: string | null): string {
  return (type && TYPE_ICON[type]) ?? '🔔';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'עכשיו';
  if (diffMin < 60) return `לפני ${diffMin} דקות`;
  if (diffHour < 24) return `לפני ${diffHour} שעות`;
  if (diffDay < 7) return `לפני ${diffDay} ימים`;
  return date.toLocaleDateString('he-IL');
}

export function NotificationsList({
  notifications,
  unreadCount,
}: {
  notifications: NotificationRow[];
  unreadCount: number;
}) {
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-4">🔔</div>
        <p className="text-gray-500 font-medium">אין התראות</p>
        <p className="text-gray-400 text-sm mt-1">כשיהיו עדכונים חדשים הם יופיעו כאן</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {unreadCount > 0 && (
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={() => markAllRead()}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors"
          >
            ✓ סמן הכל כנקרא
          </button>
        </div>
      )}
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`bg-white rounded-xl border shadow-sm p-4 flex gap-3 transition-all hover:shadow-md ${
            !n.read ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200'
          }`}
        >
          <div className="text-2xl mt-0.5 shrink-0">{getTypeIcon(n.type)}</div>
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm leading-snug ${
                !n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-600'
              }`}
            >
              {n.title}
            </p>
            {n.body && (
              <p className="text-sm text-gray-500 mt-0.5 leading-snug">{n.body}</p>
            )}
            <p className="text-xs text-gray-400 mt-1.5">{formatDate(n.created_at)}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {!n.read && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <button
                  type="button"
                  onClick={() => markRead(n.id)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors whitespace-nowrap"
                >
                  סמן נקרא
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
