// =============================================================================
// useConnectionSetup
// Orchestrates the post-save workflow: link file → fingerprint → optional bind
// =============================================================================

import { linkFileToConnection, getFileConnection } from '@/lib/file-management/api/client';
import { getFingerprint } from '@/lib/api/connection';
import { emitConnectionEvent } from './useConnectionEvents';

export interface SetupResult {
    linked: boolean;
    fingerprint: any | null;
    error?: string;
}

/**
 * After a connection is saved, automatically:
 * 1. Link the current file to the connection
 * 2. Compute a database fingerprint
 *
 * Returns a summary of what happened.
 */
export async function runConnectionSetup(
    connectionId: string,
    fileId: string | null | undefined,
): Promise<SetupResult> {
    const result: SetupResult = { linked: false, fingerprint: null };

    // Step 1: Link the file to this connection (if we have a file)
    if (fileId) {
        try {
            await linkFileToConnection(fileId, connectionId);
            result.linked = true;
            emitConnectionEvent('connection:linked', { fileId, connectionId });
        } catch (err: any) {
            console.warn('[ConnectionSetup] File link failed (non-fatal):', err.message);
            // Non-fatal — the connection itself is saved.
        }
    }

    // Step 2: Compute fingerprint (useful for drift detection later)
    // Pass fileId so the backend can set binding_token in the fingerprint record
    try {
        const fp = await getFingerprint(connectionId, fileId);
        result.fingerprint = fp.fingerprint;
    } catch (err: any) {
        console.warn('[ConnectionSetup] Fingerprint failed (non-fatal):', err.message);
    }

    return result;
}
