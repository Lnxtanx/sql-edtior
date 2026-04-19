// =============================================================================
// Payments API Client
// Frontend payment and subscription API calls
// =============================================================================

import { post, get } from './client';

// =============================================================================
// Types
// =============================================================================

export interface Plan {
    id: string;
    name: string;
    price_inr: number;
    price_usd: number;
    billing_interval: 'month' | 'year' | 'lifetime';
    credit_limit_monthly: number;
    credit_limit_daily: number;
    concurrent_limit: number;
    max_tokens_per_run: number;
    max_agent_duration_secs?: number;
    allowed_models: string[];
    features: string[];
    is_active: boolean;
}

export interface CreateOrderResponse {
    success: boolean;
    order: {
        id: string;
        amount: number;
        currency: string;
        keyId: string;
        planId: string;
        planName: string;
    };
}

export interface VerifyPaymentParams {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    user_id: string;
    plan_id: string;
    email?: string;
    name?: string;
}

export interface VerifyPaymentResponse {
    success: boolean;
    message?: string;
    plan?: {
        id: string;
        name: string;
        credit_limit_monthly: number;
    };
}

export interface UsageResponse {
    success: boolean;
    usage: {
        planId: string;
        requestCount: number;
        quotaLimit: number;
        remaining: number;
    };
}

export interface PaymentHistoryItem {
    id: string;
    orderId?: string | null;
    paymentId?: string | null;
    amount: number;
    currency: string;
    status: 'pending' | 'success' | 'failed' | 'refunded';
    planId: string;
    createdAt: string;
    paymentMethod?: string | null;
}

export interface PaymentHistoryResponse {
    success: boolean;
    payments: PaymentHistoryItem[];
}

// =============================================================================
// Payments API Functions
// =============================================================================

/**
 * Get available plans
 */
export async function getPlans(): Promise<{ plans: Plan[] }> {
    return get<{ plans: Plan[] }>('/api/payments/plans');
}

/**
 * Create a Razorpay order for a plan
 * userId is no longer sent — backend derives it from session
 */
export async function createOrder(planId: string): Promise<CreateOrderResponse> {
    return post<CreateOrderResponse>('/api/payments/create-order', { planId });
}

/**
 * Verify payment after Razorpay checkout
 */
export async function verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResponse> {
    return post<VerifyPaymentResponse>('/api/payments/verify', params);
}

/**
 * Get current usage info for a user
 */
export async function getUsage(userId: string): Promise<UsageResponse> {
    return get<UsageResponse>(`/api/payments/usage/${userId}`);
}

/**
 * Get payment history for a user
 */
export async function getPaymentHistory(userId: string): Promise<PaymentHistoryResponse> {
    return get<PaymentHistoryResponse>(`/api/payments/history/${userId}`);
}

/**
 * Get payment status
 */
export async function getPaymentStatus(paymentId: string): Promise<{ success: boolean; payment: unknown }> {
    return get<{ success: boolean; payment: unknown }>(`/api/payments/status/${paymentId}`);
}

/**
 * Request a refund
 */
export async function requestRefund(params: {
    paymentId: string;
    amount?: number;
    reason?: string;
    email?: string;
    name?: string;
}): Promise<{ success: boolean; refund: { id: string; amount: number; status: string } }> {
    return post<{ success: boolean; refund: { id: string; amount: number; status: string } }>('/api/payments/refund', params);
}
