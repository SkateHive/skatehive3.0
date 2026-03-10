"use client";
import { useState, useCallback } from "react";
import React from "react";
import SkateDialog from "@/components/shared/SkateDialog";

interface DialogConfig {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  tip?: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
}

interface DialogState extends DialogConfig {
  isOpen: boolean;
  type: "alert" | "confirm" | "prompt";
  resolve: (value: string | boolean | null) => void;
}

/**
 * useSkateDialog - Hook to replace window.prompt/confirm/alert
 * with consistent SkateHive-styled dialogs
 * 
 * Usage:
 * const { alert, confirm, prompt, SkateDialogComponent } = useSkateDialog();
 * 
 * // In component JSX:
 * <SkateDialogComponent />
 * 
 * // In handlers:
 * const description = await prompt("Describe this image:", { tip: "Be specific!" });
 * const ok = await confirm("Delete this post?");
 * await alert("Post published!");
 */
export function useSkateDialog() {
  const [dialogState, setDialogState] = useState<DialogState | null>(null);

  const closeDialog = useCallback(() => {
    setDialogState(null);
  }, []);

  const alert = useCallback((message: string, config?: Partial<DialogConfig>) => {
    return new Promise<void>((resolve) => {
      setDialogState({
        isOpen: true,
        type: "alert",
        message,
        resolve: () => resolve(),
        ...config,
      });
    });
  }, []);

  const confirm = useCallback((message: string, config?: Partial<DialogConfig>) => {
    return new Promise<boolean>((resolve) => {
      setDialogState({
        isOpen: true,
        type: "confirm",
        message,
        resolve: (value) => resolve(value as boolean),
        ...config,
      });
    });
  }, []);

  const prompt = useCallback((message: string, config?: Partial<DialogConfig>) => {
    return new Promise<string | null>((resolve) => {
      setDialogState({
        isOpen: true,
        type: "prompt",
        message,
        resolve: (value) => resolve(value as string | null),
        ...config,
      });
    });
  }, []);

  const handleConfirm = useCallback((value?: string) => {
    if (dialogState) {
      if (dialogState.type === "prompt") {
        dialogState.resolve(value || null);
      } else if (dialogState.type === "confirm") {
        dialogState.resolve(true);
      } else {
        dialogState.resolve(true);
      }
    }
    closeDialog();
  }, [dialogState, closeDialog]);

  const handleCancel = useCallback(() => {
    if (dialogState) {
      if (dialogState.type === "prompt") {
        dialogState.resolve(null);
      } else {
        dialogState.resolve(false);
      }
    }
    closeDialog();
  }, [dialogState, closeDialog]);

  const SkateDialogComponent = useCallback(() => {
    if (!dialogState) return null;

    return (
      <SkateDialog
        isOpen={dialogState.isOpen}
        onClose={handleCancel}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        placeholder={dialogState.placeholder}
        defaultValue={dialogState.defaultValue}
        tip={dialogState.tip}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        confirmColor={dialogState.confirmColor}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );
  }, [dialogState, handleConfirm, handleCancel]);

  return {
    alert,
    confirm,
    prompt,
    SkateDialogComponent,
  };
}
