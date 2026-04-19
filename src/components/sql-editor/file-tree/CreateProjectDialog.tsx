// =============================================================================
// CreateProjectDialog — Dialog for creating new projects
// =============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { Project } from '@/lib/file-management/api/client';

// =============================================================================
// Types
// =============================================================================

export interface CreateProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called when the user confirms creation */
    onConfirm: (params: { name: string; description?: string; connectionId?: string; teamId?: string }) => void;
    /** Available connections for linking */
    connections?: { id: string; name: string }[];
    /** Available teams for linking */
    teams?: { id: string; name: string }[];
}

// =============================================================================
// Component
// =============================================================================

export function CreateProjectDialog({
    open,
    onOpenChange,
    onConfirm,
    connections = [],
    teams = [],
}: CreateProjectDialogProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [connectionId, setConnectionId] = useState<string>('');
    const [teamId, setTeamId] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setName('');
            setDescription('');
            setConnectionId('');
            setTeamId('');
            // Focus input after dialog animation
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    const handleConfirm = useCallback(() => {
        const trimmedName = name.trim();
        const trimmedDescription = description.trim();
        if (!trimmedName) return;

        onConfirm({
            name: trimmedName,
            description: trimmedDescription || undefined,
            connectionId: connectionId || undefined,
            teamId: teamId || undefined,
        });
        onOpenChange(false);
    }, [name, description, connectionId, teamId, onConfirm, onOpenChange]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            }
        },
        [handleConfirm],
    );

    const isValid = name.trim().length > 0 && name.trim().length <= 255;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>
                        Create a new project to organize your SQL files and database connections.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-3">
                    {/* Project name */}
                    <div className="grid gap-2">
                        <Label htmlFor="project-name">Project Name *</Label>
                        <Input
                            ref={inputRef}
                            id="project-name"
                            placeholder="My Database Project"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            maxLength={255}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </div>

                    {/* Project description */}
                    <div className="grid gap-2">
                        <Label htmlFor="project-description">Description (Optional)</Label>
                        <Textarea
                            id="project-description"
                            placeholder="Brief description of this project..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            maxLength={1000}
                        />
                    </div>

                    {/* Default connection */}
                    {connections.length > 0 && (
                        <div className="grid gap-2">
                            <Label htmlFor="default-connection">Default Database Connection (Optional)</Label>
                            <Select value={connectionId || '__none__'} onValueChange={v => setConnectionId(v === '__none__' ? '' : v)}>
                                <SelectTrigger id="default-connection">
                                    <SelectValue placeholder="Select a database connection..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">No default connection</SelectItem>
                                    {connections.map(conn => (
                                        <SelectItem key={conn.id} value={conn.id}>
                                            {conn.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Files in this project will inherit this connection unless overridden.
                            </p>
                        </div>
                    )}

                    {/* Team assignment */}
                    {teams.length > 0 && (
                        <div className="grid gap-2">
                            <Label htmlFor="team-assignment">Team (Optional)</Label>
                            <Select value={teamId || '__none__'} onValueChange={v => setTeamId(v === '__none__' ? '' : v)}>
                                <SelectTrigger id="team-assignment">
                                    <SelectValue placeholder="Select a team..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">Personal project</SelectItem>
                                    {teams.map(team => (
                                        <SelectItem key={team.id} value={team.id}>
                                            {team.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Team members will automatically gain access to this project.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={!isValid}>
                        Create Project
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}