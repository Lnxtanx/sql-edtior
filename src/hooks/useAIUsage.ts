// =============================================================================
// useAIUsage Hook
// Fetches AI credit quota status via /api/ai/usage
// =============================================================================

import { useQuery } from '@tanstack/react-query';
import { getAIUsage, getAIModels, type AIQuotaStatus, type AIModelInfo } from '@/lib/api';
import { useAuth } from '@/components/auth/AuthProvider';

const AI_USAGE_KEY = ['ai', 'usage'] as const;
const AI_MODELS_KEY = ['ai', 'models'] as const;

/**
 * Fetches the current user's AI credit quota status.
 * Stale after 2 minutes — refreshed on window focus.
 * Returns allowed_models so the model selector can grey out plan-restricted models.
 */
export function useAIUsage() {
    const { user } = useAuth();

    const query = useQuery<AIQuotaStatus>({
        queryKey: AI_USAGE_KEY,
        queryFn: getAIUsage,
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
        enabled: !!user,
        retry: false,
    });

    const data = query.data;

    return {
        /** Full quota status from backend */
        quota: data ?? null,
        /** Credits remaining this month (or lifetime for free tier) */
        creditsRemaining: data?.credits_remaining ?? null,
        /** Daily credits remaining */
        dailyRemaining: data?.daily_remaining ?? null,
        /** Monthly usage percentage (0–100) */
        monthlyPct: data?.monthly_pct ?? 0,
        /** Models allowed by this user's plan */
        allowedModels: data?.allowed_models ?? null,
        /** Plan identifier */
        planId: data?.plan_id ?? null,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

export function useAIModels() {
    const { user } = useAuth();

    const query = useQuery<{ models: AIModelInfo[] }>({
        queryKey: AI_MODELS_KEY,
        queryFn: getAIModels,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        enabled: !!user,
        retry: false,
    });

    return {
        models: query.data?.models ?? [],
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a duration in ms as "X hr Y min" or "Y min". */
function formatDuration(ms: number): string {
    const totalMins = Math.ceil(ms / 60_000);
    const hrs  = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs > 0 && mins > 0) return `${hrs} hr ${mins} min`;
    if (hrs > 0)             return `${hrs} hr`;
    return `${mins} min`;
}

/** Next UTC midnight — when the daily counter resets. */
function nextDailyReset(): Date {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

/** ms until next UTC midnight */
function msUntilDailyReset(): number {
    return nextDailyReset().getTime() - Date.now();
}

/**
 * Returns a human-readable error string when the user is OUT of daily or
 * monthly credits. The input should be disabled when this returns non-null.
 */
export function getProactiveQuotaError(usage: AIQuotaStatus | undefined | null): string | null {
    if (!usage) return null;

    if (usage.credit_limit_daily > 0 && usage.daily_remaining <= 0) {
        const resetIn = formatDuration(msUntilDailyReset());
        return `Daily credit limit reached (${usage.credits_used_day} / ${usage.credit_limit_daily} credits used). Resets in ${resetIn} or upgrade your plan.`;
    }

    if (usage.credit_limit_monthly > 0 && usage.credits_remaining <= 0 && !usage.is_lifetime_cap) {
        return `Monthly credit limit reached (${usage.credits_used_month} / ${usage.credit_limit_monthly} credits). Upgrade your plan to continue.`;
    }

    return null;
}

export interface QuotaWarning {
    level: 'warning' | 'critical';
    message: string;
}

/**
 * Returns a warning when usage is at 75%+ or 90%+ of any limit.
 */
export function getQuotaWarning(usage: AIQuotaStatus | undefined | null): QuotaWarning | null {
    if (!usage) return null;
    if (getProactiveQuotaError(usage)) return null;

    if (usage.credit_limit_daily > 0) {
        const dailyPct = Math.round((usage.credits_used_day / usage.credit_limit_daily) * 100);
        const resetIn  = formatDuration(msUntilDailyReset());

        if (dailyPct >= 90) {
            return {
                level: 'critical',
                message: `Daily credits at ${dailyPct}% — ${usage.daily_remaining} of ${usage.credit_limit_daily} credits left. Resets in ${resetIn}.`,
            };
        }
        if (dailyPct >= 75) {
            return {
                level: 'warning',
                message: `Daily credits at ${dailyPct}% — ${usage.daily_remaining} of ${usage.credit_limit_daily} remaining today.`,
            };
        }
    }

    if (usage.credit_limit_monthly > 0 && !usage.is_lifetime_cap) {
        const mPct = usage.monthly_pct;
        if (mPct >= 90) {
            return {
                level: 'critical',
                message: `Monthly credits at ${mPct}% — ${usage.credits_remaining} of ${usage.credit_limit_monthly} credits left this month.`,
            };
        }
        if (mPct >= 75) {
            return {
                level: 'warning',
                message: `Monthly credits at ${mPct}% — ${usage.credits_remaining} of ${usage.credit_limit_monthly} remaining this month.`,
            };
        }
    }

    return null;
}
