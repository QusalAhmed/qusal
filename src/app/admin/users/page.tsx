"use client";

// =============================================================================
// Admin User Management Page
// =============================================================================
// Admin-only page for creating and managing application users.
// All operations go through server actions that verify ADMIN role.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TextInput,
  PasswordInput,
  Button,
  Select,
  Badge,
  Modal,
  Alert,
} from "@mantine/core";
import {
  AlertCircle,
  Check,
  Shield,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { createUser, listUsers, updateUserRole } from "@/server/actions/users";
import type { AppRole } from "@/types";

interface UserRecord {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
  last_sign_in_at: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create user modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("CONTRIBUTOR");
  const [creating, setCreating] = useState(false);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await listUsers();
    if (result.success) {
      setUsers(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Create user handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setSuccess(null);

    const result = await createUser({
      email: newEmail,
      password: newPassword,
      role: newRole,
    });

    if (result.success) {
      setSuccess(`User ${newEmail} created successfully`);
      setCreateModalOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewRole("CONTRIBUTOR");
      await fetchUsers();
    } else {
      setError(result.error);
    }

    setCreating(false);
  };

  // Update role handler
  const handleUpdateRole = async (userId: string, role: AppRole) => {
    setError(null);
    setSuccess(null);

    const result = await updateUserRole({ userId, role });

    if (result.success) {
      setSuccess("Role updated successfully");
      await fetchUsers();
    } else {
      setError(result.error);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={20} className="text-indigo-400" />
              <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider">
                Admin
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              User Management
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Create and manage application users
            </p>
          </div>

          <Button
            leftSection={<UserPlus size={18} />}
            variant="gradient"
            gradient={{ from: "indigo", to: "violet", deg: 135 }}
            onClick={() => setCreateModalOpen(true)}
            className="shadow-lg shadow-indigo-500/20"
          >
            Create User
          </Button>
        </motion.div>

        {/* Alerts */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Alert
                icon={<AlertCircle size={16} />}
                color="red"
                variant="light"
                withCloseButton
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Alert
                icon={<Check size={16} />}
                color="green"
                variant="light"
                withCloseButton
                onClose={() => setSuccess(null)}
              >
                {success}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User List */}
        <div className="space-y-2">
          {loading ? (
            // Skeleton loaders
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="skeleton w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-48" />
                    <div className="skeleton h-3 w-32" />
                  </div>
                  <div className="skeleton h-8 w-28 rounded-md" />
                </div>
              </div>
            ))
          ) : (
            <AnimatePresence mode="popLayout">
              {users.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className="rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] p-4"
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-lg border border-[var(--color-border-subtle)] ${
                          user.role === "ADMIN"
                            ? "bg-amber-500/10"
                            : "bg-[var(--color-surface-overlay)]"
                        }`}
                      >
                        {user.role === "ADMIN" ? (
                          <ShieldCheck size={18} className="text-amber-400" />
                        ) : (
                          <Shield
                            size={18}
                            className="text-[var(--color-text-tertiary)]"
                          />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">
                            {user.email}
                          </span>
                          <Badge
                            size="xs"
                            variant={
                              user.role === "ADMIN" ? "gradient" : "outline"
                            }
                            gradient={
                              user.role === "ADMIN"
                                ? { from: "amber", to: "orange", deg: 135 }
                                : undefined
                            }
                            color={
                              user.role === "ADMIN" ? undefined : "gray"
                            }
                          >
                            {user.role}
                          </Badge>
                        </div>
                        <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                          Created{" "}
                          {new Date(user.created_at).toLocaleDateString()}
                          {user.last_sign_in_at && (
                            <>
                              {" · "}Last sign in{" "}
                              {new Date(
                                user.last_sign_in_at
                              ).toLocaleDateString()}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <Select
                      value={user.role}
                      onChange={(value) =>
                        value &&
                        handleUpdateRole(user.id, value as AppRole)
                      }
                      data={[
                        { value: "ADMIN", label: "Admin" },
                        { value: "CONTRIBUTOR", label: "Contributor" },
                      ]}
                      size="xs"
                      className="w-32"
                      styles={{
                        input: {
                          backgroundColor: "var(--color-surface)",
                          borderColor: "var(--color-border)",
                          color: "var(--color-text-primary)",
                          fontSize: "12px",
                        },
                      }}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {/* Empty state */}
          {!loading && users.length === 0 && (
            <div className="text-center py-16">
              <Users
                size={32}
                className="text-[var(--color-text-tertiary)] mx-auto mb-4"
              />
              <h3 className="text-base font-semibold text-white mb-1">
                No users
              </h3>
              <p className="text-sm text-[var(--color-text-tertiary)]">
                Create the first user to get started
              </p>
            </div>
          )}
        </div>

        {/* Create User Modal */}
        <Modal
          opened={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title={
            <span className="text-white font-semibold">Create New User</span>
          }
          size="sm"
          styles={{
            content: {
              backgroundColor: "var(--color-surface-raised)",
            },
            header: {
              backgroundColor: "var(--color-surface-raised)",
            },
            body: {
              backgroundColor: "var(--color-surface-raised)",
            },
          }}
        >
          <form onSubmit={handleCreateUser} className="space-y-4">
            <TextInput
              label="Email"
              placeholder="user@example.com"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.currentTarget.value)}
              required
              styles={{
                input: {
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-primary)",
                },
                label: {
                  color: "var(--color-text-secondary)",
                },
              }}
            />

            <PasswordInput
              label="Password"
              placeholder="Minimum 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.currentTarget.value)}
              required
              minLength={8}
              styles={{
                input: {
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-primary)",
                },
                label: {
                  color: "var(--color-text-secondary)",
                },
              }}
            />

            <Select
              label="Role"
              value={newRole}
              onChange={(v) => v && setNewRole(v as AppRole)}
              data={[
                { value: "CONTRIBUTOR", label: "Contributor" },
                { value: "ADMIN", label: "Admin" },
              ]}
              styles={{
                input: {
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-primary)",
                },
                label: {
                  color: "var(--color-text-secondary)",
                },
              }}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="subtle"
                color="gray"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={creating}
                variant="gradient"
                gradient={{ from: "indigo", to: "violet", deg: 135 }}
              >
                Create User
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}
