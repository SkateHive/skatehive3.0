"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

interface WindowState {
  id: string;
  title: string;
  isMinimized: boolean;
  isMaximized: boolean;
}

interface WindowContextType {
  windows: WindowState[];
  registerWindow: (id: string, title: string) => void;
  unregisterWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  unmaximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  isWindowMinimized: (id: string) => boolean;
  isWindowMaximized: (id: string) => boolean;
}

const WindowContext = createContext<WindowContextType | undefined>(undefined);

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<WindowState[]>([]);

  const registerWindow = useCallback((id: string, title: string) => {
    setWindows((prev) => {
      const exists = prev.find((w) => w.id === id);
      if (exists) return prev;
      return [...prev, { id, title, isMinimized: false, isMaximized: false }];
    });
  }, []);

  const unregisterWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMinimized: true } : w))
    );
  }, []);

  const maximizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, isMaximized: true } : w
      )
    );
  }, []);

  const unmaximizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, isMaximized: false } : w
      )
    );
  }, []);

  const restoreWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMinimized: false } : w))
    );
  }, []);

  const isWindowMinimized = useCallback(
    (id: string) => {
      return windows.find((w) => w.id === id)?.isMinimized || false;
    },
    [windows]
  );

  const isWindowMaximized = useCallback(
    (id: string) => {
      return windows.find((w) => w.id === id)?.isMaximized || false;
    },
    [windows]
  );

  const value = useMemo(
    () => ({
      windows,
      registerWindow,
      unregisterWindow,
      minimizeWindow,
      maximizeWindow,
      unmaximizeWindow,
      restoreWindow,
      isWindowMinimized,
      isWindowMaximized,
    }),
    [
      windows,
      registerWindow,
      unregisterWindow,
      minimizeWindow,
      maximizeWindow,
      unmaximizeWindow,
      restoreWindow,
      isWindowMinimized,
      isWindowMaximized,
    ]
  );

  return (
    <WindowContext.Provider value={value}>
      {children}
    </WindowContext.Provider>
  );
}

export function useWindow() {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error("useWindow must be used within a WindowProvider");
  }
  return context;
}
