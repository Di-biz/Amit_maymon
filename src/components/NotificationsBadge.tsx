'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export function NotificationsBadge({ userId }: { userId: string }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const isPreview = process.env.NEXT_PUBLIC_PREVIEW_MODE === 'true';

  useEffect(() => {
    if (!userId) return;

    const loadNotifications = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('read', false);
      
      setUnreadCount((data?.length ?? 0));
    };

    loadNotifications();

    // Set up real-time subscription for PWA support
    const supabase = createClient();
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    // Request notification permission for PWA
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Show browser notification when new notification arrives
    const notificationChannel = supabase
      .channel('notifications-new')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as { title: string; body: string | null; type: string | null };
          if (Notification.permission === 'granted') {
            new Notification(notification.title, {
              body: notification.body || undefined,
              icon: '/icon-192x192.png', // PWA icon
              badge: '/icon-192x192.png',
              tag: notification.type || 'notification',
            });
          }
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      notificationChannel.unsubscribe();
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
