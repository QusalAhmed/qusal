"use client";

// =============================================================================
// Application Shell — Navigation Bar
// =============================================================================
// Responsive top navigation with:
//   - Logo/brand
//   - Navigation links
//   - Sync status indicator
//   - Auth status + sign out
// =============================================================================

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Settings,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePowerSyncProvider } from "@/lib/powersync/PowerSyncProvider";

interface NavLinkItem {
  href: string;
  label: string;
  icon: ReactNode;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
}

const navLinks: NavLinkItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: <LayoutDashboard size={18} />,
  },
  {
    href: "/words",
    label: "Words",
    icon: <BookOpen size={18} />,
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: <Users size={18} />,
    requiresAuth: true,
    requiresAdmin: true,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: <Settings size={18} />,
    requiresAuth: true,
    requiresAdmin: true,
  },
];

export function AppShell({ children }: { children: ReactNode }): ReactNode {
  const pathname = usePathname();
  const { user, signOut, loading: authLoading } = useAuth();
  const { syncStatus } = usePowerSyncProvider();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filter nav links based on auth state
  // Note: admin check is done client-side for visibility only.
  // Actual admin route protection is in middleware + server actions.
  const visibleLinks = navLinks.filter((link) => {
    if (link.requiresAuth && !user) return false;
    // Show admin links to all authenticated users (server enforces actual auth)
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
                <BookOpen size={16} className="text-white" />
              </div>
              <span className="text-lg font-bold gradient-text hidden sm:block">
                Qusal
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {visibleLinks.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/" && pathname.startsWith(link.href));

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`
                      relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                      ${
                        isActive
                          ? "text-white bg-[var(--color-surface-overlay)]"
                          : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-surface-overlay)]/50"
                      }
                    `}
                  >
                    {link.icon}
                    {link.label}
                    {isActive && (
                      <motion.div
                        layoutId="nav-active-pill"
                        className="absolute inset-0 rounded-lg bg-[var(--color-surface-overlay)] -z-10"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right Side — Sync Status + Auth */}
            <div className="flex items-center gap-3">
              {/* Sync Status */}
              {user && (
                <div
                  className="flex items-center gap-1.5 text-xs"
                  title={
                    syncStatus.connected
                      ? `Synced${syncStatus.lastSyncedAt ? ` at ${syncStatus.lastSyncedAt.toLocaleTimeString()}` : ""}`
                      : "Offline — changes saved locally"
                  }
                >
                  {syncStatus.connected ? (
                    <Wifi
                      size={14}
                      className="text-[var(--color-success)]"
                    />
                  ) : (
                    <WifiOff
                      size={14}
                      className="text-[var(--color-text-tertiary)]"
                    />
                  )}
                  <span
                    className={`hidden sm:inline ${
                      syncStatus.connected
                        ? "text-[var(--color-success)]"
                        : "text-[var(--color-text-tertiary)]"
                    }`}
                  >
                    {syncStatus.connected ? "Synced" : "Offline"}
                  </span>
                </div>
              )}

              {/* Auth Button */}
              {user ? (
                <button
                  onClick={() => signOut()}
                  disabled={authLoading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-surface-overlay)]/50 transition-colors disabled:opacity-50"
                >
                  <LogOut size={16} />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              ) : (
                <Link
                  href="/auth/login"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-400 hover:to-violet-500 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all"
                >
                  <LogIn size={16} />
                  <span>Sign In</span>
                </Link>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-surface-overlay)]/50 transition-colors"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden border-t border-[var(--color-border)]"
            >
              <nav className="px-4 py-3 space-y-1">
                {visibleLinks.map((link) => {
                  const isActive =
                    pathname === link.href ||
                    (link.href !== "/" && pathname.startsWith(link.href));

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                        ${
                          isActive
                            ? "text-white bg-[var(--color-surface-overlay)]"
                            : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-surface-overlay)]/50"
                        }
                      `}
                    >
                      {link.icon}
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
