"use client";

// =============================================================================
// Add Word Page
// =============================================================================
// Full-page form for creating a new vocabulary word with definitions and tags.
// Requires authentication — redirects to login if not signed in.
// =============================================================================

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Container, Title, Text, Breadcrumbs, Anchor } from "@mantine/core";
import { BookOpen, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

import { AppShell } from "@/components/layout/AppShell";
import { WordForm } from "@/components/forms/WordForm";
import { useAuth } from "@/hooks/useAuth";

export default function AddWordPage() {
  const router = useRouter();
  const { user, isInitialized } = useAuth();

  const handleSuccess = useCallback(
    (wordId: string) => {
      router.push(`/words/${wordId}`);
    },
    [router]
  );

  const handleCancel = useCallback(() => {
    router.push("/words");
  }, [router]);

  // Show loading state while checking auth
  if (!isInitialized) {
    return (
      <AppShell>
        <Container size="md" py="xl">
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        </Container>
      </AppShell>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return (
      <AppShell>
        <Container size="md" py="xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
              <BookOpen size={28} className="text-violet-400" />
            </div>
            <Title order={3} mb="xs">
              Sign in required
            </Title>
            <Text c="dimmed" size="sm" mb="lg">
              You need to be signed in to add words to the knowledge base.
            </Text>
            <Anchor
              component={Link}
              href={`/auth/login?redirectTo=/words/new`}
              className="text-violet-400 hover:text-violet-300"
            >
              Sign in to continue →
            </Anchor>
          </motion.div>
        </Container>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Container size="md" py="xl">
        {/* Breadcrumbs */}
        <Breadcrumbs
          separator={<ChevronRight size={14} />}
          mb="lg"
          styles={{
            separator: { color: "var(--color-text-tertiary)" },
          }}
        >
          <Anchor component={Link} href="/" size="sm" c="dimmed">
            Dashboard
          </Anchor>
          <Anchor component={Link} href="/words" size="sm" c="dimmed">
            Words
          </Anchor>
          <Text size="sm" c="white">
            Add Word
          </Text>
        </Breadcrumbs>

        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Title order={2} mb={4}>
            Add New Word
          </Title>
          <Text c="dimmed" size="sm" mb="xl">
            Add a vocabulary word with definitions, notes, and tags. Changes are
            saved locally and sync automatically.
          </Text>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="glass-card p-6 rounded-xl"
        >
          <WordForm onSuccess={handleSuccess} onCancel={handleCancel} />
        </motion.div>
      </Container>
    </AppShell>
  );
}
