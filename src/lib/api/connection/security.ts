// =============================================================================
// Security API
// Permissions, fingerprinting, database binding
// =============================================================================

import { post } from '../client';
import type { Permissions, Fingerprint, BindingResult } from './types';

/**
 * Check what permissions the connection's DB user has
 */
export async function checkPermissions(
    connectionId: string
): Promise<{ success: boolean; permissions: Permissions }> {
    return post(`/api/connection/${connectionId}/permissions`, {});
}

/**
 * Generate a fingerprint for the connected database instance.
 * If fileId is provided, it also sets binding_token for this DB.
 */
export async function getFingerprint(
    connectionId: string,
    fileId?: string | null
): Promise<{ success: boolean; fingerprint: Fingerprint; connectionId: string }> {
    return post(`/api/connection/${connectionId}/fingerprint`, { fileId: fileId || undefined });
}

/**
 * Check if this database is bound to a specific file (or any file if fileId omitted)
 */
export async function checkBinding(
    connectionId: string,
    fileId?: string
): Promise<{ success: boolean; fingerprint: Fingerprint; binding: BindingResult }> {
    return post(`/api/connection/${connectionId}/binding/check`, { fileId });
}

/**
 * Claim exclusive binding on this database for the current user & file
 */
export async function claimBinding(
    connectionId: string,
    fileId: string,
    environmentTag?: string
): Promise<{ success: boolean; fingerprint: Fingerprint; binding: { bindingToken: string } }> {
    return post(`/api/connection/${connectionId}/binding/claim`, { fileId, environmentTag });
}
