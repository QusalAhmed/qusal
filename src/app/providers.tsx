"use client";

// =============================================================================
// Client Providers
// =============================================================================
// Wraps the application with all necessary client-side providers:
//   1. MantineProvider (theme + dark mode)
//   2. PowerSyncProvider (database + sync + auth state)
// =============================================================================

import { ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import { theme } from "@/lib/theme";
import { PowerSyncProvider } from "@/lib/powersync/PowerSyncProvider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps): ReactNode {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark" forceColorScheme="dark">
      <PowerSyncProvider>{children}</PowerSyncProvider>
    </MantineProvider>
  );
}
