// =============================================================================
// Security Tab
// Professional security configuration and access control
// =============================================================================

import { Shield, Lock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SecurityTabProps {
  databaseId: string;
}

export function SecurityTab({ databaseId }: SecurityTabProps) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground">Security & Access Control</h3>
          <p className="text-sm text-muted-foreground mt-1">Manage roles, permissions, and encryption settings</p>
        </div>

        {/* Security Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="border border-border rounded-lg p-6 bg-card flex items-start gap-4">
            <Shield className="w-5 h-5 text-green-500 shrink-0 mt-1" />
            <div>
              <p className="text-sm font-semibold text-foreground">SSL/TLS Encryption</p>
              <p className="text-xs text-muted-foreground mt-1">Enabled - All connections encrypted</p>
              <Button variant="outline" size="sm" className="mt-3">Configure</Button>
            </div>
          </div>
          <div className="border border-border rounded-lg p-6 bg-card flex items-start gap-4">
            <Lock className="w-5 h-5 text-green-500 shrink-0 mt-1" />
            <div>
              <p className="text-sm font-semibold text-foreground">Password Policy</p>
              <p className="text-xs text-muted-foreground mt-1">Strong encryption enforced</p>
              <Button variant="outline" size="sm" className="mt-3">Update Policy</Button>
            </div>
          </div>
        </div>

        {/* User Roles */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-foreground">User Roles</h4>
            <Button size="sm" className="gap-2">
              <Users className="w-4 h-4" />
              Add Role
            </Button>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-card border-b border-border px-6 py-3 grid grid-cols-3 gap-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role</div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Permissions</div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</div>
            </div>
            <div className="divide-y divide-border">
              <div className="px-6 py-4 grid grid-cols-3 gap-4 items-center hover:bg-accent/50">
                <p className="text-sm font-medium text-foreground">Admin</p>
                <p className="text-sm text-muted-foreground">Full Access</p>
                <Button variant="ghost" size="sm">Edit</Button>
              </div>
              <div className="px-6 py-4 grid grid-cols-3 gap-4 items-center hover:bg-accent/50">
                <p className="text-sm font-medium text-foreground">Developer</p>
                <p className="text-sm text-muted-foreground">Read/Write</p>
                <Button variant="ghost" size="sm">Edit</Button>
              </div>
              <div className="px-6 py-4 grid grid-cols-3 gap-4 items-center hover:bg-accent/50">
                <p className="text-sm font-medium text-foreground">Viewer</p>
                <p className="text-sm text-muted-foreground">Read Only</p>
                <Button variant="ghost" size="sm">Edit</Button>
              </div>
            </div>
          </div>
        </div>

        {/* Backup Settings */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-4">Backup & Recovery</h4>
          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Automatic Backups</p>
                <p className="text-xs text-muted-foreground mt-1">Daily at 2:00 AM (UTC)</p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 rounded">Active</span>
            </div>
            <Button variant="outline" className="w-full">Configure Backup Schedule</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
