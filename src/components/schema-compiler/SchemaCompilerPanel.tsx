/**
 * Schema Compiler Panel
 * 
 * Full-height panel showing compilation results with sidebar navigation
 * and detail views for each of the 20 layers.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Cpu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CompilationResult, CompilationLayer, LetterGrade } from '@/lib/schema-compiler/types';
import type { ParsedSchema } from '@/lib/sql-parser';
import { gradeColor } from './utils';
import { LayerNav } from './LayerNav';
import { OverviewView } from './OverviewView';
import { LayerDetailView } from './LayerDetailView';

// ============================================================================
// Main Panel
// ============================================================================

interface SchemaCompilerPanelProps {
    compilation: CompilationResult | null;
    schema: ParsedSchema | null;
    onClose: () => void;
}

export function SchemaCompilerPanel({ compilation, schema, onClose }: SchemaCompilerPanelProps) {
    const [selectedLayer, setSelectedLayer] = useState<CompilationLayer | 'overview'>('overview');

    if (!compilation) {
        return (
            <div className="flex flex-col h-full">
                <PanelHeader onClose={onClose} />
                <div className="flex-1 flex items-center justify-center p-6 text-center">
                    <div className="space-y-2">
                        <Cpu className="w-10 h-10 mx-auto text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                            No compilation results yet.
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                            Write SQL and click Generate to compile your schema.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <PanelHeader
                onClose={onClose}
                grade={compilation.overallGrade}
                score={compilation.overallScore}
                totalIssues={compilation.totalIssues}
                compilationTime={compilation.compilationTime}
            />
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-[140px] border-r bg-muted/20 overflow-y-auto shrink-0">
                    <LayerNav
                        summaries={compilation.layerSummaries}
                        selected={selectedLayer}
                        onSelect={setSelectedLayer}
                    />
                </div>
                {/* Detail */}
                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        {selectedLayer === 'overview' ? (
                            <OverviewView compilation={compilation} onSelectLayer={setSelectedLayer} />
                        ) : (
                            <LayerDetailView
                                layer={selectedLayer}
                                compilation={compilation}
                            />
                        )}
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// Panel Header
// ============================================================================

function PanelHeader({
    onClose,
    grade,
    score,
    totalIssues,
    compilationTime,
}: {
    onClose: () => void;
    grade?: LetterGrade;
    score?: number;
    totalIssues?: number;
    compilationTime?: number;
}) {
    return (
        <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/40">
            <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-violet-600" />
                <span className="text-xs font-medium">Schema Compiler</span>
                {grade && (
                    <Badge variant="outline" className={cn("text-[9px] px-1.5 h-4", gradeColor(grade))}>
                        {grade} ({score}/100)
                    </Badge>
                )}
                {totalIssues !== undefined && totalIssues > 0 && (
                    <Badge variant="outline" className="text-[9px] px-1.5 h-4 bg-yellow-50 text-yellow-700 border-yellow-200">
                        {totalIssues} issues
                    </Badge>
                )}
            </div>
            <div className="flex items-center gap-2">
                {compilationTime !== undefined && (
                    <span className="text-[9px] text-muted-foreground">
                        {compilationTime.toFixed(0)}ms
                    </span>
                )}
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={onClose}>
                    <X className="w-3 h-3" />
                </Button>
            </div>
        </div>
    );
}
