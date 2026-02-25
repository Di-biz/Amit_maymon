'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export function NotificationsBadge({ userId }: { userId: string }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';
  const lastNotificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const loadNotifications = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('notifications')
          .select('id, created_at')
          .eq('user_id', userId)
          .eq('read', false)
          .order('created_at', { ascending: false });
        
        const rows = (data ?? []) as { id: string; created_at: string }[];
        const count = rows.length;
        setUnreadCount(count);

        // Check for new notifications for PWA
        if (rows.length > 0) {
          const latestId = rows[0].id;
          if (lastNotificationIdRef.current && latestId !== lastNotificationIdRef.current) {
            if ('Notification' in window && Notification.permission === 'granted') {
              const { data: fullNotificationData } = await supabase
                .from('notifications')
                .select('title, body, type')
                .eq('id', latestId)
                .single();
              const fullNotification = fullNotificationData as { title: string; body: string | null; type: string | null } | null;
              if (fullNotification) {
                new Notification(fullNotification.title || 'התראה חדשה', {
                  body: fullNotification.body || undefined,
                  icon: '/icon-192.png',
                  badge: '/icon-192.png',
                  tag: fullNotification.type || 'notification',
                });
              }
            }
          }
          lastNotificationIdRef.current = latestId;
        }
      } catch (error) {
        console.error('[NotificationsBadge] Error loading notifications:', error);
      }
    };

    // Initial load
    loadNotifications();

    // Request notification permission for PWA
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Poll for updates every 10 seconds (instead of realtime subscriptions)
    const intervalId = setInterval(() => {
      loadNotifications();
    }, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, [userId]);

  if (unreadCount === 0) return null;

  return (
    <Link
      href="/notifications"
      className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full border-2 border-white shadow-lg hover:bg-red-600 transition-colors"
      title={`${unreadCount} התראות לא נקראו`}
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </Link>
  );
}
