import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import useEffectiveHiveUser from "@/hooks/useEffectiveHiveUser";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import { Notifications } from "@hiveio/dhive";
import {
  fetchNewNotifications,
  getLastReadNotificationDate,
} from "@/lib/hive/client-functions";
import { parseHiveDate } from "@/lib/utils/hiveDate";

/** App-owned notification (migration 0030) — things SkateHive decided, as
 *  opposed to the Hive chain events above. */
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

interface NotificationContextProps {
  notifications: Notifications[];
  /** App notifications, newest first. Empty when signed out of userbase. */
  appNotifications: AppNotification[];
  appUnreadCount: number;
  /** Hive unread + app unread — what the sidebar badge should show. */
  newNotificationCount: number;
  lastReadDate: string;
  refreshNotifications: () => Promise<void>;
  markNotificationsAsRead: () => Promise<void>;
  /** Mark app notifications read: all of them, or a specific set. */
  markAppNotificationsAsRead: (ids?: string[]) => Promise<void>;
  isLoading: boolean;
  farcasterEnabled: boolean;
  enableFarcasterNotifications: () => void;
  disableFarcasterNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(
  undefined
);

export const NotificationProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { handle: effectiveUser } = useEffectiveHiveUser();
  // App notifications need a userbase session. Gating on it keeps logged-out
  // visitors from firing a guaranteed 401 on every single page load.
  // (NotificationProvider renders inside UserbaseAuthProvider — see
  // app/RootLayoutClient.tsx wrapping Providers.)
  const { user: userbaseUser } = useUserbaseAuth();
  const [notifications, setNotifications] = useState<Notifications[]>([]);
  const [lastReadDate, setLastReadDate] = useState("1970-01-01T00:00:00Z");
  const [isLoading, setIsLoading] = useState(false);
  const [farcasterEnabled, setFarcasterEnabled] = useState(false);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);
  const [appUnreadCount, setAppUnreadCount] = useState(0);

  /**
   * App notifications ride the userbase session cookie, not the Hive handle —
   * a 401 just means the user isn't signed into userbase, which is normal for
   * Keychain-only users. Stay quiet and show nothing rather than erroring.
   */
  const refreshAppNotifications = useCallback(async () => {
    if (!userbaseUser) {
      setAppNotifications([]);
      setAppUnreadCount(0);
      return;
    }
    try {
      const res = await fetch("/api/userbase/notifications?limit=30", {
        credentials: "include",
      });
      if (!res.ok) {
        setAppNotifications([]);
        setAppUnreadCount(0);
        return;
      }
      const data = await res.json();
      setAppNotifications(Array.isArray(data?.items) ? data.items : []);
      setAppUnreadCount(data?.unread_count ?? 0);
    } catch {
      setAppNotifications([]);
      setAppUnreadCount(0);
    }
  }, [userbaseUser]);

  const refreshNotifications = useCallback(async () => {
    // App notifications don't depend on a Hive handle, so they refresh even
    // for a user who never linked Hive.
    const appTask = refreshAppNotifications();

    if (!effectiveUser) {
      setNotifications([]);
      setLastReadDate("1970-01-01T00:00:00Z");
      await appTask;
      return;
    }

    setIsLoading(true);
    try {
      const [notifs, lastRead] = await Promise.all([
        fetchNewNotifications(effectiveUser),
        getLastReadNotificationDate(effectiveUser),
      ]);
      setNotifications(notifs);
      setLastReadDate((prev) =>
        parseHiveDate(lastRead) > parseHiveDate(prev) ? lastRead : prev
      );
    } catch (error) {
      // Error handled silently for production
    } finally {
      setIsLoading(false);
    }
    await appTask;
  }, [effectiveUser, refreshAppNotifications]);

  const markAppNotificationsAsRead = useCallback(
    async (ids?: string[]) => {
      const nowIso = new Date().toISOString();
      // Optimistic — the badge should drop the instant the user opens the page.
      setAppNotifications((prev) =>
        prev.map((n) =>
          !n.read_at && (!ids || ids.includes(n.id)) ? { ...n, read_at: nowIso } : n
        )
      );
      setAppUnreadCount((prev) => (ids ? Math.max(prev - ids.length, 0) : 0));
      try {
        const res = await fetch("/api/userbase/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(ids ? { ids } : { all: true }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (typeof data?.unread_count === "number") {
            setAppUnreadCount(data.unread_count);
          }
        } else {
          // Server disagreed — re-sync rather than leaving a lying badge.
          await refreshAppNotifications();
        }
      } catch {
        await refreshAppNotifications();
      }
    },
    [refreshAppNotifications]
  );

  const markNotificationsAsRead = useCallback(async () => {
    if (!effectiveUser) return;

    // Update the last read date to now
    const now = new Date().toISOString();
    setLastReadDate(now);

    // Here you could also make an API call to persist this on the server
    // For now, this will just update the local state
  }, [effectiveUser]);

  const enableFarcasterNotifications = useCallback(() => {
    setFarcasterEnabled(true);
  }, []);

  const disableFarcasterNotifications = useCallback(() => {
    setFarcasterEnabled(false);
  }, []);

  // Memoize the notification count calculation to avoid recalculating on every render
  const newNotificationCount = useMemo(() => {
    const hiveUnread =
      !notifications || notifications.length === 0
        ? 0
        : notifications.filter(
            (notification) =>
              parseHiveDate(notification.date).getTime() >
              parseHiveDate(lastReadDate).getTime()
          ).length;

    // One badge for both sources — a user shouldn't have to know which half of
    // the system a notification came from to notice it.
    return hiveUnread + appUnreadCount;
  }, [notifications, lastReadDate, appUnreadCount]);

  // Load notifications when user changes
  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const value = useMemo(
    () => ({
      notifications,
      appNotifications,
      appUnreadCount,
      newNotificationCount,
      lastReadDate,
      refreshNotifications,
      markNotificationsAsRead,
      markAppNotificationsAsRead,
      isLoading,
      farcasterEnabled,
      enableFarcasterNotifications,
      disableFarcasterNotifications,
    }),
    [
      notifications,
      appNotifications,
      appUnreadCount,
      newNotificationCount,
      lastReadDate,
      refreshNotifications,
      markNotificationsAsRead,
      markAppNotificationsAsRead,
      isLoading,
      farcasterEnabled,
      enableFarcasterNotifications,
      disableFarcasterNotifications,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextProps => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
};
