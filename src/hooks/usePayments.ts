// =============================================================================
// Payment & Usage React Query Hooks
// Wraps payments API with caching, invalidation, and optimistic updates
// =============================================================================

import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { SUBSCRIPTION_QUERY_KEY } from '@/hooks/useSubscription';
import {
  getPlans,
  createOrder,
  verifyPayment,
  getUsage,
  getPaymentHistory,
  type Plan,
  type CreateOrderResponse,
  type VerifyPaymentParams,
  type VerifyPaymentResponse,
  type UsageResponse,
  type PaymentHistoryResponse,
} from '@/lib/api/payments';

// =============================================================================
// Query Hooks
// =============================================================================

/** Fetch available plans — rarely change, cache aggressively */
export function usePlans() {
  return useQuery({
    queryKey: queryKeys.payments.plans,
    queryFn: getPlans,
    staleTime: 60 * 60 * 1000,   // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

/** Fetch current usage for a user — updates after AI requests */
export function useUsage(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.payments.usage(userId!),
    queryFn: () => getUsage(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000,         // 30 seconds
    refetchOnWindowFocus: true,
  });
}

/** Fetch payment history for a user */
export function usePaymentHistory(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.payments.history(userId!),
    queryFn: () => getPaymentHistory(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/** Create a Razorpay order — no longer requires userId from client */
export function useCreateOrder() {
  return useMutation<CreateOrderResponse, Error, { planId: string }>({
    mutationFn: ({ planId }) => createOrder(planId),
  });
}

/** Verify payment after Razorpay checkout — invalidates subscription, AI usage, and profile */
export function useVerifyPayment() {
  return useMutation<VerifyPaymentResponse, Error, VerifyPaymentParams>({
    mutationFn: verifyPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile });
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['ai-usage'] });
    },
  });
}
