// =============================================================================
// Health API
// Connection health checks and event history
// =============================================================================

import { get } from '../client';
import type { ConnectionHealth, HealthEvent } from './types';

/**
 * Check health of a specific connection (latency, status, version)
 */
export async function getConnectionHealth(
    connectionId: string
): Promise<{
    success: boolean;
    connectionId: string;
    connectionName: string;
    status: ConnectionHealth['status'];
    latencyMs?: number;
    serverVersion?: string;
    error?: string;
}> {
    return get(`/api/connection/${connectionId}/health`);
}

/**
 * Get connection event history (health checks, errors, etc.)
 */
export async function getHealthEvents(
    connectionId: string,
    options?: { limit?: number; eventType?: string }
): Promise<{ success: boolean; events: HealthEvent[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.eventType) params.set('eventType', options.eventType);

    const query = params.toString() ? `?${params.toString()}` : '';
    return get(`/api/connection/${connectionId}/health/events${query}`);
}
