import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { User } from 'lucide-react';
import { Role } from '@/lib/sql-parser';

export interface RoleNodeData {
    label: string;
    roleDef?: Role;
    isHighlighted?: boolean;
}

const RoleNode = ({ data }: NodeProps<any>) => {
    const { label, roleDef, isHighlighted } = data as RoleNodeData;

    const headerGradient = 'from-slate-600 to-slate-700';
    const borderColor = '#475569';

    return (
        <div
            className={`relative bg-background rounded-lg shadow-sm border overflow-hidden flex flex-col`}
            style={{
                borderColor: isHighlighted ? borderColor : 'var(--border)',
                boxShadow: isHighlighted ? `0 0 0 1px ${borderColor}, 0 4px 6px -1px rgb(0 0 0 / 0.1)` : undefined,
                minWidth: '200px',
            }}
        >
            {/* Header */}
            <div className={`px-3 py-2 bg-gradient-to-r ${headerGradient} text-white flex items-center justify-between`}>
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <User className="w-4 h-4 text-white/90 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="font-semibold text-xs truncate" title={label}>
                            {label}
                        </div>
                    </div>
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider bg-black/20 px-1.5 py-0.5 rounded ml-2 shrink-0">
                    ROLE
                </div>
            </div>

            {/* Body */}
            {roleDef && (
                <div className="px-3 py-2 bg-muted/10 border-t border-border/50">
                    <div className="flex flex-wrap gap-1">
                        {roleDef.isSuperuser && (
                            <span className="text-[10px] font-mono bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800">
                                SUPERUSER
                            </span>
                        )}
                        {roleDef.canLogin && (
                            <span className="text-[10px] font-mono bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-800">
                                LOGIN
                            </span>
                        )}
                        {roleDef.canCreateDb && (
                            <span className="text-[10px] font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                                CREATEDB
                            </span>
                        )}
                        {roleDef.canCreateRole && (
                            <span className="text-[10px] font-mono bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                                CREATEROLE
                            </span>
                        )}
                        {roleDef.bypassRls && (
                            <span className="text-[10px] font-mono bg-orange-50 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800">
                                BYPASSRLS
                            </span>
                        )}
                        {!roleDef.inherit && (
                            <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                NOINHERIT
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Handles */}
            <Handle
                type="target"
                position={Position.Left}
                className="!w-2 !h-2 !bg-border border-2 !border-background"
                isConnectable={false}
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!w-2 !h-2 !bg-border border-2 !border-background"
                isConnectable={false}
            />
        </div>
    );
};

export default memo(RoleNode);
