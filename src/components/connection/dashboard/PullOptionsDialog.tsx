import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FileCode2, Files, FolderTree } from 'lucide-react';

export type PullMode = 'single' | 'split-by-schema' | 'split-by-table';

interface PullOptionsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (mode: PullMode) => void;
    isPulling: boolean;
}

export function PullOptionsDialog({ open, onOpenChange, onConfirm, isPulling }: PullOptionsDialogProps) {
    const [mode, setMode] = useState<PullMode>('single');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Pull Database Schema</DialogTitle>
                    <DialogDescription>
                        How would you like to organize the pulled SQL files?
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <RadioGroup value={mode} onValueChange={(v) => setMode(v as PullMode)} className="space-y-4">
                        <div className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setMode('single')}>
                            <RadioGroupItem value="single" id="single" className="mt-1" />
                            <Label htmlFor="single" className="flex flex-col cursor-pointer flex-1">
                                <span className="font-semibold flex items-center gap-2">
                                    <FileCode2 className="w-4 h-4 text-blue-500" />
                                    Single File
                                </span>
                                <span className="text-xs text-muted-foreground font-normal mt-1 leading-relaxed">
                                    Pull everything into the currently active SQL file. Overwrites existing content. Ideal for small databases.
                                </span>
                            </Label>
                        </div>

                        <div className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setMode('split-by-schema')}>
                            <RadioGroupItem value="split-by-schema" id="split-by-schema" className="mt-1" />
                            <Label htmlFor="split-by-schema" className="flex flex-col cursor-pointer flex-1">
                                <span className="font-semibold flex items-center gap-2">
                                    <Files className="w-4 h-4 text-emerald-500" />
                                    Split by Schema
                                </span>
                                <span className="text-xs text-muted-foreground font-normal mt-1 leading-relaxed">
                                    Create a separate file for each schema (e.g., public.sql, auth.sql). Good for medium-sized databases.
                                </span>
                            </Label>
                        </div>

                        <div className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setMode('split-by-table')}>
                            <RadioGroupItem value="split-by-table" id="split-by-table" className="mt-1" />
                            <Label htmlFor="split-by-table" className="flex flex-col cursor-pointer flex-1">
                                <span className="font-semibold flex items-center gap-2">
                                    <FolderTree className="w-4 h-4 text-violet-500" />
                                    Split by Table
                                </span>
                                <span className="text-xs text-muted-foreground font-normal mt-1 leading-relaxed">
                                    Create a folder structure with one SQL file per table, view, or function. Best for large projects.
                                </span>
                            </Label>
                        </div>
                    </RadioGroup>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPulling}>
                        Cancel
                    </Button>
                    <Button onClick={() => onConfirm(mode)} disabled={isPulling}>
                        {isPulling ? 'Pulling...' : 'Start Pull'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
