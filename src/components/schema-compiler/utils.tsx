import {
    AlertTriangle, AlertOctagon, Info,
    Layers, Database, Table, Columns, Tag, Lock, Search,
    Grid, Eye, Code, Zap, Shield, Key, Hash, Puzzle,
    GitBranch, HardDrive, RefreshCw, Brain, BarChart2
} from 'lucide-react';
import type { LetterGrade, CompilationLayer } from '@/lib/schema-compiler/types';

export const LAYER_ICONS: Record<CompilationLayer, React.ComponentType<{ className?: string }>> = {
    database: Database,
    schema: Layers,
    table: Table,
    column: Columns,
    type: Tag,
    constraint: Lock,
    index: Search,
    partition: Grid,
    view: Eye,
    function: Code,
    trigger: Zap,
    rls: Shield,
    privilege: Key,
    sequence: Hash,
    extension: Puzzle,
    dependency: GitBranch,
    storage: HardDrive,
    replication: RefreshCw,
    semantic: Brain,
    metrics: BarChart2,
};

export function gradeColor(grade: LetterGrade): string {
    switch (grade) {
        case 'A': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        case 'B': return 'text-blue-600 bg-blue-50 border-blue-200';
        case 'C': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        case 'D': return 'text-orange-600 bg-orange-50 border-orange-200';
        case 'F': return 'text-red-600 bg-red-50 border-red-200';
    }
}

export function severityIcon(severity: string) {
    switch (severity) {
        case 'critical':
        case 'error':
            return <AlertOctagon className="w-3 h-3 text-red-500 shrink-0" />;
        case 'warning':
            return <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />;
        default:
            return <Info className="w-3 h-3 text-blue-500 shrink-0" />;
    }
}

export function severityBadgeColor(severity: string): string {
    switch (severity) {
        case 'critical':
        case 'error':
            return 'bg-red-100 text-red-700 border-red-200';
        case 'warning':
            return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        default:
            return 'bg-blue-100 text-blue-700 border-blue-200';
    }
}
