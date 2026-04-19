// =============================================================================
// CurrentFileContext
// Provides the active file ID & name to any component that needs it
// (ConnectionDialog, ConnectionPanel, FileConnectionLink, etc.)
// =============================================================================

import { createContext, useContext } from 'react';

interface CurrentFileInfo {
    fileId: string | null;
    fileName: string | null;
    connectionId?: string | null;  // Linked database connection ID
    projectId?: string | null;     // Active project ID
    projectName?: string | null;   // Active project name
    schema?: any; // ParsedSchema
    sql?: string; // Raw SQL text from editor (for Atlas mode)
    mergedSql?: string; // Merged SQL for the entire active project (if applicable)
}

const CurrentFileContext = createContext<CurrentFileInfo>({
    fileId: null,
    fileName: null,
    connectionId: null,
    projectId: null,
    projectName: null,
    schema: null,
    sql: undefined,
    mergedSql: undefined,
});

export const CurrentFileProvider = CurrentFileContext.Provider;

export function useCurrentFile(): CurrentFileInfo {
    return useContext(CurrentFileContext);
}
