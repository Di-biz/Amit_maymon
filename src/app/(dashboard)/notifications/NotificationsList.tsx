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

export function NotificationsList({ notifications }: { notifications: NotificationRow[] }) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-2">
      {unreadCount > 0 && (
        <button
          type="button"
          onClick={() => markAllRead()}
          className="text-sm text-blue-600 underline mb-2"
        >
          סמן הכל כנקרא
        </button>
      )}
      {notifications.length === 0 ? (
        <p className="text-gray-500">אין התראות</p>
      ) : (
        <ul className="divide-y divide-gray-200 bg-white rounded border border-gray-200 overflow-hidden">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`py-3 px-4 ${n.read ? 'bg-gray-50' : 'bg-white'}`}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="text-sm text-gray-600 mt-1">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleString('he-IL')}
                  </p>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="text-sm text-blue-600 shrink-0"
                  >
                    סמן נקרא
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
