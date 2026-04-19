// =============================================================================
// Error & Traffic Reporter (MVP)
// Zero-dependency client-side error capture + page view tracking
// Batches and flushes via navigator.sendBeacon for reliability
// =============================================================================

import { API_BASE_URL, getCsrfToken } from './api/client';

// =============================================================================
// Error Queue — batch errors and flush periodically
// =============================================================================

interface QueuedError {
  message: string;
  stack?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

const errorQueue: QueuedError[] = [];
const FLUSH_INTERVAL_MS = 5_000;
let flushTimer: ReturnType<typeof setInterval> | null = null;

function flushErrors() {
  if (errorQueue.length === 0) return;

  const batch = errorQueue.splice(0, errorQueue.length);
  for (const err of batch) {
    sendBeaconJson(`${API_BASE_URL}/api/telemetry/error`, err);
  }
}

// =============================================================================
// Public API
// =============================================================================

/** Report an error to the telemetry backend */
export function reportError(
  message: string,
  stack?: string,
  metadata?: Record<string, unknown>,
) {
  errorQueue.push({
    message,
    stack,
    url: window.location.href,
    metadata,
  });
}

/** Track a page view */
export function trackPageView(path: string) {
  sendBeaconJson(`${API_BASE_URL}/api/telemetry/pageview`, {
    path,
    referrer: document.referrer || undefined,
  });
}

/** Initialize global error listeners. Call once on app start. */
export function initErrorReporter() {
  // Unhandled errors
  window.addEventListener('error', (event) => {
    reportError(
      event.message || 'Uncaught error',
      event.error?.stack,
      { filename: event.filename, lineno: event.lineno, colno: event.colno },
    );
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? 'Unhandled rejection');
    const stack = reason instanceof Error ? reason.stack : undefined;
    reportError(message, stack, { type: 'unhandledrejection' });
  });

  // Flush on page unload
  window.addEventListener('beforeunload', flushErrors);

  // Periodic flush
  flushTimer = setInterval(flushErrors, FLUSH_INTERVAL_MS);

  // Track initial page view
  trackPageView(window.location.pathname);
}

// =============================================================================
// Internals
// =============================================================================

function sendBeaconJson(url: string, data: unknown) {
  try {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const sent = navigator.sendBeacon(url, blob);
    if (!sent) {
      // Fallback to fetch (fire-and-forget)
      fetch(url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
          ...(getCsrfToken() ? { 'X-CSRF-Token': getCsrfToken()! } : {}),
        },
        credentials: 'include',
        keepalive: true,
      }).catch(() => { /* swallow — telemetry should never throw */ });
    }
  } catch {
    /* swallow */
  }
}
