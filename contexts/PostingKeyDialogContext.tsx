"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import dynamic from "next/dynamic";

const PostingKeyDialog = dynamic(
  () => import("@/components/userbase/PostingKeyDialog"),
  { ssr: false }
);

interface OpenPostingKeyDialogOptions {
  /** Optional Hive handle to surface in the dialog copy. */
  hiveHandle?: string | null;
}

interface PostingKeyDialogContextValue {
  isOpen: boolean;
  hiveHandle: string | null;
  openPostingKeyDialog: (options?: OpenPostingKeyDialogOptions) => void;
  closePostingKeyDialog: () => void;
}

const PostingKeyDialogContext =
  createContext<PostingKeyDialogContextValue | null>(null);

export function PostingKeyDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hiveHandle, setHiveHandle] = useState<string | null>(null);

  const openPostingKeyDialog = useCallback(
    (options?: OpenPostingKeyDialogOptions) => {
      setHiveHandle(options?.hiveHandle ?? null);
      setIsOpen(true);
    },
    []
  );

  const closePostingKeyDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo<PostingKeyDialogContextValue>(
    () => ({
      isOpen,
      hiveHandle,
      openPostingKeyDialog,
      closePostingKeyDialog,
    }),
    [isOpen, hiveHandle, openPostingKeyDialog, closePostingKeyDialog]
  );

  return (
    <PostingKeyDialogContext.Provider value={value}>
      {children}
      {isOpen && (
        <PostingKeyDialog
          isOpen={isOpen}
          onClose={closePostingKeyDialog}
          hiveHandle={hiveHandle}
        />
      )}
    </PostingKeyDialogContext.Provider>
  );
}

export function usePostingKeyDialog() {
  const context = useContext(PostingKeyDialogContext);
  if (!context) {
    // Safe fallback so the hook can be called before the provider mounts
    // (e.g. during SSR snapshots) without throwing — calls are silent no-ops.
    return {
      isOpen: false,
      hiveHandle: null,
      openPostingKeyDialog: () => {},
      closePostingKeyDialog: () => {},
    } as PostingKeyDialogContextValue;
  }
  return context;
}
