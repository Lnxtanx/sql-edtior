/**
 * EditorRoleContext.tsx
 * 
 * React Context for providing role information to editor and related components.
 * Avoids prop drilling and provides a clean way to access permissions.
 */

import React, { createContext, useContext, ReactNode } from 'react';
import type { CollaborationRole } from '@/hooks/useCollaborationRole';
import { canEdit, canAdmin } from '@/hooks/useCollaborationRole';

interface EditorRoleContextType {
  role: CollaborationRole | null;
  canEdit: boolean;
  canAdmin: boolean;
  isReadOnly: boolean;
}

const EditorRoleContext = createContext<EditorRoleContextType | undefined>(undefined);

/**
 * Provider component - wrap your editor with this
 * 
 * Usage:
 * <EditorRoleProvider role={currentProject.role}>
 *   <SqlEditor />
 * </EditorRoleProvider>
 */
export function EditorRoleProvider({
  role,
  children,
}: {
  role: CollaborationRole | null;
  children: ReactNode;
}) {
  const value: EditorRoleContextType = {
    role,
    canEdit: canEdit(role),
    canAdmin: canAdmin(role),
    isReadOnly: role === 'viewer' || role === null,
  };

  return (
    <EditorRoleContext.Provider value={value}>
      {children}
    </EditorRoleContext.Provider>
  );
}

/**
 * Hook to use editor role context
 * Must be used within EditorRoleProvider
 * 
 * Usage:
 * const { isReadOnly, canEdit, role } = useEditorRole();
 */
export function useEditorRole(): EditorRoleContextType {
  const context = useContext(EditorRoleContext);
  if (!context) {
    throw new Error('useEditorRole must be used within EditorRoleProvider');
  }
  return context;
}

/**
 * Optional hook - returns null if not in provider (useful for optional context)
 * 
 * Usage:
 * const editorRole = useEditorRoleOptional();
 * if (editorRole?.isReadOnly) { ... }
 */
export function useEditorRoleOptional(): EditorRoleContextType | null {
  return useContext(EditorRoleContext) ?? null;
}
