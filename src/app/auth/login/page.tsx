"use client";

// =============================================================================
// Login Page
// =============================================================================
// Email/password login form. No public registration — users are created
// by admins only. The form provides a clean, focused login experience.
// =============================================================================

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { TextInput, PasswordInput, Button, Alert } from "@mantine/core";
import { BookOpen, AlertCircle, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/";
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }

    const success = await signIn(email, password);
    if (success) {
      router.push(redirectTo);
    } else {
      setError("Invalid email or password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-500/30"
          >
            <BookOpen size={28} className="text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
          <p className="text-[var(--color-text-secondary)] text-sm">
            Sign in to access your vocabulary learning
          </p>
        </div>

        {/* Login Form */}
        <div className="glass rounded-2xl p-6 sm:p-8 glow-indigo">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <Alert
                  icon={<AlertCircle size={16} />}
                  color="red"
                  variant="light"
                  radius="md"
                >
                  {error}
                </Alert>
              </motion.div>
            )}

            <TextInput
              label="Email"
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
              size="md"
              autoComplete="email"
              styles={{
                input: {
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-primary)",
                },
                label: {
                  color: "var(--color-text-secondary)",
                  marginBottom: "4px",
                },
              }}
            />

            <PasswordInput
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
              size="md"
              autoComplete="current-password"
              styles={{
                input: {
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-primary)",
                },
                label: {
                  color: "var(--color-text-secondary)",
                  marginBottom: "4px",
                },
              }}
            />

            <Button
              type="submit"
              fullWidth
              size="md"
              loading={loading}
              leftSection={<LogIn size={18} />}
              variant="gradient"
              gradient={{ from: "indigo", to: "violet", deg: 135 }}
              className="shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-shadow"
            >
              Sign In
            </Button>
          </form>

          <p className="text-center text-xs text-[var(--color-text-tertiary)] mt-6">
            Contact your administrator if you need an account
          </p>
        </div>
      </motion.div>
    </div>
  );
}
