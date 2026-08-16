"use client";

// =============================================================================
// Tiptap Rich Text Editor Component
// =============================================================================
// A controlled rich text editor for definition notes.
// Uses starter-kit (bold, italic, lists, headings, code, blockquote) plus
// a placeholder extension.
//
// Security: Content is stored as Tiptap JSON (not raw HTML). Rendering uses
// Tiptap's built-in renderer which sanitizes output by construction —
// only known node/mark types are rendered.
// =============================================================================

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { ActionIcon, Group, Tooltip } from "@mantine/core";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading2,
  Heading3,
  Undo,
  Redo,
  RemoveFormatting,
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type { JSONContent } from "@tiptap/react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TiptapEditorProps {
  /** Current editor content as Tiptap JSON */
  content: JSONContent | null;
  /** Called when content changes */
  onChange: (content: JSONContent | null) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the editor is editable */
  editable?: boolean;
}

// ---------------------------------------------------------------------------
// Toolbar Button
// ---------------------------------------------------------------------------

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function ToolbarButton({
  icon,
  label,
  isActive,
  onClick,
  disabled,
}: ToolbarButtonProps) {
  return (
    <Tooltip label={label} withArrow position="top">
      <ActionIcon
        variant={isActive ? "filled" : "subtle"}
        color={isActive ? "violet" : "gray"}
        size="sm"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function TiptapEditor({
  content,
  onChange,
  placeholder = "Add notes about this definition…",
  editable = true,
}: TiptapEditorProps) {
  // Track whether update comes from parent or editor
  const isInternalChange = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: content ?? undefined,
    editable,
    onUpdate: ({ editor: updatedEditor }) => {
      isInternalChange.current = true;
      const json = updatedEditor.getJSON();
      // If editor is empty (just an empty paragraph), report null
      const isEmpty = updatedEditor.isEmpty;
      onChange(isEmpty ? null : json);
    },
    // Prevent SSR rendering issues
    immediatelyRender: false,
  });

  // Sync external content changes (e.g., form reset)
  useEffect(() => {
    if (!editor || isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }

    const currentJSON = JSON.stringify(editor.getJSON());
    const newJSON = JSON.stringify(content);

    if (currentJSON !== newJSON) {
      editor.commands.setContent(content ?? { type: "doc", content: [] });
    }
  }, [content, editor]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  const toggleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const toggleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run();
  }, [editor]);

  const toggleOrderedList = useCallback(() => {
    editor?.chain().focus().toggleOrderedList().run();
  }, [editor]);

  const toggleBlockquote = useCallback(() => {
    editor?.chain().focus().toggleBlockquote().run();
  }, [editor]);

  const toggleCode = useCallback(() => {
    editor?.chain().focus().toggleCode().run();
  }, [editor]);

  const toggleH2 = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 2 }).run();
  }, [editor]);

  const toggleH3 = useCallback(() => {
    editor?.chain().focus().toggleHeading({ level: 3 }).run();
  }, [editor]);

  const handleUndo = useCallback(() => {
    editor?.chain().focus().undo().run();
  }, [editor]);

  const handleRedo = useCallback(() => {
    editor?.chain().focus().redo().run();
  }, [editor]);

  const clearFormatting = useCallback(() => {
    editor?.chain().focus().clearNodes().unsetAllMarks().run();
  }, [editor]);

  if (!editor) {
    return (
      <div
        className="rounded-lg border border-[var(--glass-border)] p-3"
        style={{ minHeight: 120 }}
      >
        <div className="h-4 w-24 animate-pulse rounded bg-[var(--glass-bg)]" />
      </div>
    );
  }

  return (
    <div className="tiptap-wrapper rounded-lg border border-[var(--glass-border)] overflow-hidden">
      {/* Toolbar */}
      {editable && (
        <Group
          gap={2}
          className="border-b border-[var(--glass-border)] px-2 py-1"
          style={{ background: "var(--glass-bg)" }}
        >
          <ToolbarButton
            icon={<Bold size={14} />}
            label="Bold"
            isActive={editor.isActive("bold")}
            onClick={toggleBold}
          />
          <ToolbarButton
            icon={<Italic size={14} />}
            label="Italic"
            isActive={editor.isActive("italic")}
            onClick={toggleItalic}
          />
          <ToolbarButton
            icon={<Code size={14} />}
            label="Code"
            isActive={editor.isActive("code")}
            onClick={toggleCode}
          />

          <div className="w-px h-4 bg-[var(--glass-border)] mx-1" />

          <ToolbarButton
            icon={<Heading2 size={14} />}
            label="Heading 2"
            isActive={editor.isActive("heading", { level: 2 })}
            onClick={toggleH2}
          />
          <ToolbarButton
            icon={<Heading3 size={14} />}
            label="Heading 3"
            isActive={editor.isActive("heading", { level: 3 })}
            onClick={toggleH3}
          />

          <div className="w-px h-4 bg-[var(--glass-border)] mx-1" />

          <ToolbarButton
            icon={<List size={14} />}
            label="Bullet List"
            isActive={editor.isActive("bulletList")}
            onClick={toggleBulletList}
          />
          <ToolbarButton
            icon={<ListOrdered size={14} />}
            label="Ordered List"
            isActive={editor.isActive("orderedList")}
            onClick={toggleOrderedList}
          />
          <ToolbarButton
            icon={<Quote size={14} />}
            label="Blockquote"
            isActive={editor.isActive("blockquote")}
            onClick={toggleBlockquote}
          />

          <div className="w-px h-4 bg-[var(--glass-border)] mx-1" />

          <ToolbarButton
            icon={<Undo size={14} />}
            label="Undo"
            onClick={handleUndo}
            disabled={!editor.can().undo()}
          />
          <ToolbarButton
            icon={<Redo size={14} />}
            label="Redo"
            onClick={handleRedo}
            disabled={!editor.can().redo()}
          />
          <ToolbarButton
            icon={<RemoveFormatting size={14} />}
            label="Clear formatting"
            onClick={clearFormatting}
          />
        </Group>
      )}

      {/* Editor */}
      <div className="tiptap-content px-3 py-2" style={{ minHeight: 100 }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Read-Only Renderer
// ---------------------------------------------------------------------------

/**
 * Renders Tiptap JSON content in read-only mode.
 * Uses Tiptap's built-in rendering which only outputs known node types.
 */
export function TiptapViewer({ content }: { content: JSONContent | null }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
    ],
    content: content ?? undefined,
    editable: false,
    immediatelyRender: false,
  });

  if (!editor || !content) return null;

  return (
    <div className="tiptap-content tiptap-readonly">
      <EditorContent editor={editor} />
    </div>
  );
}
