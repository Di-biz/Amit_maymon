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
        
        const count = data?.length ?? 0;
        setUnreadCount(count);

        // Check for new notifications for PWA
        if (data && data.length > 0) {
          const latestId = data[0].id;
          if (lastNotificationIdRef.current && latestId !== lastNotificationIdRef.current) {
            // New notification arrived - show browser notification
            const latest = data[0];
            if ('Notification' in window && Notification.permission === 'granted') {
              // Get full notification details
              const { data: fullNotification } = await supabase
                .from('notifications')
                .select('title, body, type')
                .eq('id', latestId)
                .single();
              
              if (fullNotification) {
                new Notification(fullNotification.title || 'התראה חדשה', {
                  body: fullNotification.body || undefined,
                  icon: '/icon-192x192.png',
                  badge: '/icon-192x192.png',
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
