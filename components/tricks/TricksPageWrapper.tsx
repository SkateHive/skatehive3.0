"use client";

import React from "react";
interface TricksPageWrapperProps {
  children: React.ReactNode;
}

export default function TricksPageWrapper({ children }: TricksPageWrapperProps) {
  return <>{children}</>;
}
