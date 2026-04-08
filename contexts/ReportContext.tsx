"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { ReportOptions } from "@/types/report";

interface ReportContextValue {
  isOpen: boolean;
  reportOptions: ReportOptions | undefined;
  openReport: (opts?: ReportOptions) => void;
  closeReport: () => void;
}

const ReportContext = createContext<ReportContextValue | null>(null);

export function ReportProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reportOptions, setReportOptions] = useState<ReportOptions | undefined>();

  const openReport = useCallback((opts?: ReportOptions) => {
    setReportOptions(opts);
    setIsOpen(true);
  }, []);

  const closeReport = useCallback(() => {
    setIsOpen(false);
    setReportOptions(undefined);
  }, []);

  return (
    <ReportContext.Provider value={{ isOpen, reportOptions, openReport, closeReport }}>
      {children}
    </ReportContext.Provider>
  );
}

const NOOP_CONTEXT: ReportContextValue = {
  isOpen: false,
  reportOptions: undefined,
  openReport: () => {},
  closeReport: () => {},
};

export function useReport(): ReportContextValue {
  const ctx = useContext(ReportContext);
  // Outside provider (e.g. during SSR or early hydration) — return no-op
  return ctx ?? NOOP_CONTEXT;
}
