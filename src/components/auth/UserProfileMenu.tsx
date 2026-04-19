
import {
    LogOut,
    User as UserIcon,
    Loader2,
    Sparkles,
    Zap
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useUserProfile } from '@/hooks/useUserProfile';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';

interface UserProfileMenuProps {
    user: User;
    signOut: () => void;
    className?: string;
}

export function UserProfileMenu({ user, signOut, className }: UserProfileMenuProps) {
    const { profile, usage, isLoading } = useUserProfile();

    const displayName = profile?.full_name || user?.user_metadata?.full_name || '';
    const displayEmail = profile?.email || user?.email || '';
    const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || '';

    const initials = displayName
        ?.split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U';

    const planName = usage?.plan_id === 'pro_monthly' ? 'Pro Plan' : 'Free Plan';
    const isPro = usage?.plan_id === 'pro_monthly';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={cn("relative h-8 w-8 rounded-full ml-2 p-0", className)}>
                    <Avatar className="h-full w-full border border-slate-200">
                        <AvatarImage src={avatarUrl} alt={displayName} />
                        <AvatarFallback className="bg-blue-100 text-blue-600 font-medium text-xs">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                        {displayName && (
                            <p className="font-medium text-sm text-slate-900">{displayName}</p>
                        )}
                        {displayEmail && (
                            <p className="w-[200px] truncate text-xs text-slate-500">{displayEmail}</p>
                        )}
                    </div>
                </div>

                <DropdownMenuSeparator />

                <div className="p-2">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            {isPro ? <Sparkles className="w-3.5 h-3.5 text-purple-500" /> : <Zap className="w-3.5 h-3.5 text-slate-400" />}
                            {planName}
                        </span>
                        {isPro && <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-purple-50 text-purple-600 border-purple-200">ACTIVE</Badge>}
                    </div>

                    {isLoading ? (
                        <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Loading usage...
                        </div>
                    ) : usage ? (
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] text-slate-500">
                                <span>AI Requests</span>
                                <span>{usage.requests_count} / {usage.quota_limit}</span>
                            </div>
                            <Progress value={(usage.requests_count / usage.quota_limit) * 100} className="h-1" />
                        </div>
                    ) : null}
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={signOut} className="text-red-600 focus:text-red-600 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
