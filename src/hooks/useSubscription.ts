// =============================================================================
// useSubscription — fetches the authenticated user's active subscription
// Endpoint: GET /api/payments/subscription
// Returns: sw_subscriptions row joined with sw_plans (or free-plan defaults)
// =============================================================================

import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SwPlan {
    id: string;
    name: string;
    price_inr: number;
    price_usd: number;
    billing_interval: string;
    credit_limit_monthly: number;
    credit_limit_daily: number;
    concurrent_limit: number;
    max_tokens_per_run: number;
    allowed_models: string[];
    features: string[];
    is_active: boolean;
}

export interface Subscription {
    id?: string;
    user_id?: string;
    plan_id: string;
    status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'paused';
    provider: string;
    provider_order_id?: string | null;
    provider_payment_id?: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    canceled_at?: string | null;
    created_at?: string;
    updated_at?: string;
    sw_plans: SwPlan | null;
}

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_QUERY_KEY = ['subscription'] as const;

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetchSubscription(): Promise<Subscription> {
    return get<Subscription>('/api/payments/subscription');
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSubscription() {
    const query = useQuery({
        queryKey: SUBSCRIPTION_QUERY_KEY,
        queryFn:  fetchSubscription,
        staleTime: 5 * 60 * 1000,      // 5 minutes — subscriptions change rarely
        refetchOnWindowFocus: false,
    });

    const sub = query.data;
    const plan = sub?.sw_plans;

    // Convenience derived values
    const planId        = sub?.plan_id ?? 'free';
    const isActive      = sub?.status === 'active';
    const isFree        = planId === 'free';
    const isPaid        = !isFree && isActive;
    const periodEnd     = sub?.current_period_end ? new Date(sub.current_period_end) : null;
    const cancelPending = sub?.cancel_at_period_end ?? false;

    return {
        subscription:  sub ?? null,
        plan,
        planId,
        isActive,
        isFree,
        isPaid,
        periodEnd,
        cancelPending,
        isLoading: query.isLoading,
        error:     query.error,
        refetch:   query.refetch,
    };
}
