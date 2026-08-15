"use client";

// =============================================================================
// Admin Settings Page
// =============================================================================
// Placeholder for system-level configuration.
// Will be expanded in future phases.
// =============================================================================

import { motion } from "framer-motion";
import { Settings, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

export default function AdminSettingsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={20} className="text-indigo-400" />
            <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider">
              Admin
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Settings
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            System-level configuration
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-overlay)] flex items-center justify-center mx-auto mb-4 border border-[var(--color-border)]">
            <Settings
              size={24}
              className="text-[var(--color-text-tertiary)]"
            />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">
            Coming Soon
          </h3>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            System settings will be available in a future update
          </p>
        </motion.div>
      </div>
    </AppShell>
  );
}
