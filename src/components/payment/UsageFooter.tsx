import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ExternalLink } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAIUsage } from '@/hooks/useAIUsage';

const PRICING_URL = 'https://schemaweaver.vivekmind.com/pricing';

export function UsageFooter() {
    const [open, setOpen] = useState(false);
    const { usage } = useUserProfile();
    const { quota, creditsRemaining, monthlyPct, planId } = useAIUsage();

    // Prefer credit-based data when available; fall back to legacy request count
    const hasCredits = quota !== null;
    const percentage = hasCredits
        ? Math.min(100, monthlyPct)
        : Math.min(100, ((usage?.requests_count ?? 0) / (usage?.quota_limit ?? 100)) * 100);
    const remaining = hasCredits
        ? (creditsRemaining ?? 0)
        : (usage?.quota_limit ?? 100) - (usage?.requests_count ?? 0);
    const isPro = (planId ?? usage?.plan_id) !== 'free';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 gap-1.5"
                >
                    <img src="/resona.png" alt="Resona" className={`w-3 h-3 ${isPro ? 'opacity-100' : 'opacity-60'}`} />
                    {usage ? `${Math.round(percentage)}%` : 'Usage'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-popover text-popover-foreground border-border p-0 shadow-xl" side="top" align="end">
                {/* Header */}
                <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wide uppercase text-slate-600">Resona AI Usage</span>
                    <img src="/resona.png" alt="Resona" className="w-3 h-3" />
                </div>

                <div className="p-4 space-y-4">
                    {/* Credits / AI Requests */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-700">
                                {hasCredits ? 'AI Credits' : 'AI Requests'}
                            </span>
                            <span className="text-slate-500">
                                {hasCredits
                                    ? `${quota!.credits_used_month.toLocaleString()} / ${quota!.credit_limit_monthly.toLocaleString()}`
                                    : usage
                                        ? `${usage.requests_count} / ${usage.quota_limit}`
                                        : '...'}
                            </span>
                        </div>
                        <Progress
                            value={percentage}
                            className={`h-1.5 bg-slate-100 [&>div]:bg-blue-500 ${percentage > 90 ? "[&>div]:bg-red-500" : percentage > 75 ? "[&>div]:bg-amber-500" : ""}`}
                        />
                        {remaining <= (hasCredits ? 50 : 10) && remaining > 0 && (
                            <p className="text-xs text-amber-600">
                                Only {remaining.toLocaleString()} {hasCredits ? 'credits' : 'requests'} remaining
                            </p>
                        )}
                        {hasCredits && quota!.credits_balance > 0 && (
                            <p className="text-xs text-slate-500">
                                + {quota!.credits_balance.toLocaleString()} top-up credits
                            </p>
                        )}
                    </div>

                    {/* Plan Status */}
                    <div className="flex items-center justify-between text-sm pt-2">
                        <span className="text-slate-600">Current Plan</span>
                        <span className={`font-medium ${isPro ? 'text-blue-600' : 'text-slate-700'}`}>
                            {(() => {
                                const p = planId ?? usage?.plan_id;
                                if (p === 'pro_monthly' || p === 'pro_yearly') return 'PRO';
                                if (p === 'starter') return 'STARTER';
                                if (p === 'power_monthly') return 'POWER';
                                return 'FREE';
                            })()}
                        </span>
                    </div>

                    {/* CTA */}
                    {!isPro && (
                        <div className="pt-2">
                            <Button
                                size="sm"
                                variant="secondary"
                                className="w-full h-8 text-xs bg-blue-600 text-white hover:bg-blue-700 border-0 gap-1.5"
                                onClick={() => {
                                    setOpen(false);
                                    window.open(PRICING_URL, '_blank', 'noopener');
                                }}
                            >
                                Upgrade Plan
                                <ExternalLink className="h-3 w-3" />
                            </Button>
                            <p className="text-[10px] text-slate-400 text-center mt-2">
                                View plans on schemaweaver.vivekmind.com
                            </p>
                        </div>
                    )}

                    {isPro && (
                        <div className="pt-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-8 text-xs border-border bg-card hover:bg-muted text-foreground gap-1.5"
                                onClick={() => {
                                    setOpen(false);
                                    window.open(PRICING_URL, '_blank', 'noopener');
                                }}
                            >
                                Manage Subscription
                                <ExternalLink className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-2 border-t border-slate-200 text-[10px] text-slate-400 text-center">
                    {isPro ? 'Thank you for being a member!' : 'Upgrade to unlock more AI credits'}
                </div>

            </PopoverContent>
        </Popover>
    );
}
