import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import useEffectiveHiveUser from "@/hooks/useEffectiveHiveUser";
import { Notifications } from "@hiveio/dhive";
import {
  fetchNewNotifications,
  getLastReadNotificationDate,
} from "@/lib/hive/client-functions";
import { parseHiveDate } from "@/lib/utils/hiveDate";

interface NotificationContextProps {
  notifications: Notifications[];
  newNotificationCount: number;
  lastReadDate: string;
  refreshNotifications: () => Promise<void>;
  markNotificationsAsRead: () => Promise<void>;
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
  const [notifications, setNotifications] = useState<Notifications[]>([]);
  const [lastReadDate, setLastReadDate] = useState("1970-01-01T00:00:00Z");
  const [isLoading, setIsLoading] = useState(false);
  const [farcasterEnabled, setFarcasterEnabled] = useState(false);

  const refreshNotifications = useCallback(async () => {
    if (!effectiveUser) {
      setNotifications([]);
      setLastReadDate("1970-01-01T00:00:00Z");
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
  }, [effectiveUser]);

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
    if (!notifications || notifications.length === 0) return 0;

    const lastReadTimestamp = parseHiveDate(lastReadDate).getTime();

    return notifications.filter(
      (notification) =>
        parseHiveDate(notification.date).getTime() > lastReadTimestamp
    ).length;
  }, [notifications, lastReadDate]);

  // Load notifications when user changes
  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const value = useMemo(
    () => ({
      notifications,
      newNotificationCount,
      lastReadDate,
      refreshNotifications,
      markNotificationsAsRead,
      isLoading,
      farcasterEnabled,
      enableFarcasterNotifications,
      disableFarcasterNotifications,
    }),
    [
      notifications,
      newNotificationCount,
      lastReadDate,
      refreshNotifications,
      markNotificationsAsRead,
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
