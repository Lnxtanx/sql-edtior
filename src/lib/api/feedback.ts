import { post } from './client';

export interface FeedbackSubmission {
    type: string;
    content: string;
    attachments?: string[];
    metadata?: Record<string, any>;
}

/**
 * Submit user feedback to the backend.
 * Supports both JSON (legacy) and FormData (modern, for file uploads).
 */
export async function submitFeedback(data: FormData | FeedbackSubmission) {
    return post('/api/feedback', data);
}
