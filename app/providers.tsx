"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { StoreBoot } from "@/components/store/store-boot";
import { BackupAgent } from "@/components/store/backup-agent";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <StoreBoot />
        <BackupAgent />
        {children}
      </MotionConfig>
    </ThemeProvider>
  );
}
