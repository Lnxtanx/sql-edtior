import { Plus, Trash2, Link, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, Column } from '@/lib/sql-parser';
import { cn } from '@/lib/utils';
import { POSTGRES_TYPES } from '../hooks/useTableEditor';

interface VisualColumnEditorProps {
    editedTable: Table;
    refTables: Table[];
    errors: string[];
    handleColumnChange: (index: number, field: keyof Column, value: any) => void;
    handleReferenceChange: (index: number, refTable: string, refColumn: string) => void;
    addColumn: () => void;
    removeColumn: (index: number) => void;
    moveColumn: (from: number, to: number) => void;
}

export function VisualColumnEditor({
    editedTable,
    refTables,
    errors,
    handleColumnChange,
    handleReferenceChange,
    addColumn,
    removeColumn,
    moveColumn
}: VisualColumnEditorProps) {
    return (
        <div className="p-3 sm:p-4">
            {/* Desktop Column Headers - Hidden on mobile */}
            <div className="hidden lg:grid grid-cols-[24px_1fr_140px_60px_60px_60px_1fr_32px] gap-2 mb-2 text-xs font-semibold text-muted-foreground uppercase">
                <span></span>
                <span>Column</span>
                <span>Type</span>
                <span className="text-center">PK</span>
                <span className="text-center">UQ</span>
                <span className="text-center">Null</span>
                <span>Reference</span>
                <span></span>
            </div>

            {/* Columns */}
            {editedTable.columns.map((column, index) => (
                <div
                    key={index}
                    className={cn(
                        "mb-3 lg:mb-0 p-3 lg:p-0 rounded-lg lg:rounded border lg:border-0",
                        "lg:grid lg:grid-cols-[24px_1fr_140px_60px_60px_60px_1fr_32px] lg:gap-2 lg:items-center lg:py-1.5 lg:px-1 hover:bg-muted/50",
                        column.isPrimaryKey && "bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50",
                        column.isForeignKey && "bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/50",
                        !column.isPrimaryKey && !column.isForeignKey && "bg-background"
                    )}
                >
                    {/* Mobile Header Row */}
                    <div className="flex lg:hidden items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                                <button
                                    onClick={() => moveColumn(index, index - 1)}
                                    disabled={index === 0}
                                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-1"
                                >
                                    ▲
                                </button>
                                <button
                                    onClick={() => moveColumn(index, index + 1)}
                                    disabled={index === editedTable.columns.length - 1}
                                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-1"
                                >
                                    ▼
                                </button>
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">Column {index + 1}</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeColumn(index)}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    </div>

                    {/* Desktop Drag Handle - Hidden on mobile */}
                    <div className="hidden lg:flex flex-col items-center gap-0.5">
                        <button
                            onClick={() => moveColumn(index, index - 1)}
                            disabled={index === 0}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                            ▲
                        </button>
                        <button
                            onClick={() => moveColumn(index, index + 1)}
                            disabled={index === editedTable.columns.length - 1}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                            ▼
                        </button>
                    </div>

                    {/* Mobile: Name & Type Row */}
                    <div className="grid grid-cols-2 gap-2 mb-2 lg:hidden">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                            <Input
                                value={column.name}
                                onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                                className="h-9 text-sm font-mono"
                                placeholder="column_name"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                            <Select
                                value={POSTGRES_TYPES.includes(column.type.toUpperCase()) ? column.type.toUpperCase() : column.type}
                                onValueChange={(v) => handleColumnChange(index, 'type', v)}
                            >
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {POSTGRES_TYPES.map(t => (
                                        <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Desktop Column Name - Hidden on mobile */}
                    <Input
                        value={column.name}
                        onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                        className="hidden lg:flex h-7 text-xs font-mono"
                        placeholder="column_name"
                    />

                    {/* Desktop Type - Hidden on mobile */}
                    <Select
                        value={POSTGRES_TYPES.includes(column.type.toUpperCase()) ? column.type.toUpperCase() : column.type}
                        onValueChange={(v) => handleColumnChange(index, 'type', v)}
                    >
                        <SelectTrigger className="hidden lg:flex h-7 text-xs">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            {POSTGRES_TYPES.map(t => (
                                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Mobile: Checkboxes Row */}
                    <div className="flex items-center gap-4 mb-2 lg:hidden">
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={column.isPrimaryKey}
                                onCheckedChange={(checked) => handleColumnChange(index, 'isPrimaryKey', checked)}
                                className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                            />
                            <span className="text-xs">Primary Key</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={column.isUnique}
                                onCheckedChange={(checked) => handleColumnChange(index, 'isUnique', checked)}
                            />
                            <span className="text-xs">Unique</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={column.nullable}
                                onCheckedChange={(checked) => handleColumnChange(index, 'nullable', checked)}
                                disabled={column.isPrimaryKey}
                            />
                            <span className="text-xs">Nullable</span>
                        </label>
                    </div>

                    {/* Desktop Primary Key */}
                    <div className="hidden lg:flex justify-center">
                        <Checkbox
                            checked={column.isPrimaryKey}
                            onCheckedChange={(checked) => handleColumnChange(index, 'isPrimaryKey', checked)}
                            className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                        />
                    </div>

                    {/* Desktop Unique */}
                    <div className="hidden lg:flex justify-center">
                        <Checkbox
                            checked={column.isUnique}
                            onCheckedChange={(checked) => handleColumnChange(index, 'isUnique', checked)}
                        />
                    </div>

                    {/* Desktop Nullable */}
                    <div className="hidden lg:flex justify-center">
                        <Checkbox
                            checked={column.nullable}
                            onCheckedChange={(checked) => handleColumnChange(index, 'nullable', checked)}
                            disabled={column.isPrimaryKey}
                        />
                    </div>

                    {/* Reference - Both mobile and desktop */}
                    <div className="flex gap-1 lg:gap-1">
                        {column.isForeignKey ? (
                            <div className="flex flex-col sm:flex-row gap-2 w-full lg:flex-row lg:gap-1">
                                <Select
                                    value={column.references?.table || ''}
                                    onValueChange={(v) => {
                                        const refTable = refTables.find(t => t.name === v);
                                        const firstPK = refTable?.columns.find(c => c.isPrimaryKey);
                                        handleReferenceChange(index, v, firstPK?.name || 'id');
                                    }}
                                >
                                    <SelectTrigger className="h-9 lg:h-7 text-sm lg:text-xs flex-1">
                                        <SelectValue placeholder="Table" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {refTables.map(t => (
                                            <SelectItem key={t.name} value={t.name} className="text-sm lg:text-xs">{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="flex gap-1">
                                    <Select
                                        value={column.references?.column || ''}
                                        onValueChange={(v) => handleReferenceChange(index, column.references?.table || '', v)}
                                    >
                                        <SelectTrigger className="h-9 lg:h-7 text-sm lg:text-xs flex-1 lg:w-24">
                                            <SelectValue placeholder="Column" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(refTables.find(t => t.name === column.references?.table)?.columns || []).map(c => (
                                                <SelectItem key={c.name} value={c.name} className="text-sm lg:text-xs">
                                                    {c.name} {c.isPrimaryKey && '(PK)'}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 lg:h-7 lg:w-7"
                                        onClick={() => handleColumnChange(index, 'isForeignKey', false)}
                                    >
                                        <X className="w-4 h-4 lg:w-3 lg:h-3" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 lg:h-7 text-sm lg:text-xs"
                                onClick={() => handleColumnChange(index, 'isForeignKey', true)}
                            >
                                <Link className="w-4 h-4 lg:w-3 lg:h-3 mr-1" />
                                Add FK
                            </Button>
                        )}
                    </div>

                    {/* Desktop Delete - Hidden on mobile */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="hidden lg:flex h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeColumn(index)}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            ))}

            {/* Add Column Button */}
            <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full h-8"
                onClick={addColumn}
            >
                <Plus className="w-4 h-4 mr-1" />
                Add Column
            </Button>

            {/* Errors */}
            {errors.length > 0 && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                    {errors.map((error, i) => (
                        <p key={i} className="text-sm text-destructive">{error}</p>
                    ))}
                </div>
            )}
        </div>
    );
}
