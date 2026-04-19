/**
 * DeleteConfirmDialog.tsx
 * 
 * Confirmation dialog for destructive operations (delete file)
 * Security: Cannot dismiss with escape, requires explicit click
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export interface DeleteConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  itemName: string;
  itemType?: string; // "file", "member", etc.
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isDangerous?: boolean;
}

/**
 * Delete confirmation dialog
 * 
 * Usage:
 * const [isOpen, setIsOpen] = useState(false);
 * 
 * return (
 *   <>
 *     <button onClick={() => setIsOpen(true)}>Delete</button>
 *     <DeleteConfirmDialog
 *       isOpen={isOpen}
 *       itemName="my-file.sql"
 *       itemType="file"
 *       onConfirm={() => deleteFile()}
 *       onCancel={() => setIsOpen(false)}
 *     />
 *   </>
 * );
 */
export function DeleteConfirmDialog({
  isOpen,
  title = 'Delete Item?',
  description = 'This action cannot be undone. Please confirm.',
  itemName,
  itemType = 'file',
  isLoading = false,
  onConfirm,
  onCancel,
  isDangerous = true,
}: DeleteConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await Promise.resolve(onConfirm());
    } finally {
      setIsConfirming(false);
    }
  };

  const isProcessing = isLoading || isConfirming;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Don't allow closing with keyboard or backdrop for dangerous operations
      if (!open && isDangerous) {
        return;
      }
      if (!open) {
        onCancel();
      }
    }}>
      <DialogContent 
        className="sm:max-w-[425px]"
        // Prevent closing with escape key for dangerous operations
        onEscapeKeyDown={(e) => {
          if (isDangerous) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <DialogTitle className="text-red-600">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-gray-600 mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 border-y border-gray-200">
          <p className="text-sm text-gray-500 mb-2">
            {itemType.charAt(0).toUpperCase() + itemType.slice(1)} to delete:
          </p>
          <p className="text-base font-semibold text-gray-900 break-all">
            {itemName}
          </p>
        </div>

        <div className="text-sm text-red-600 font-medium">
          ⚠️ This action is permanent and cannot be undone.
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
            className="sm:order-2"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="sm:order-3"
          >
            {isProcessing ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin inline-block">⚙️</span>
                Deleting...
              </>
            ) : (
              `Delete ${itemType}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Simple version for removing members
 */
export interface RemoveConfirmDialogProps {
  isOpen: boolean;
  userName: string;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function RemoveConfirmDialog({
  isOpen,
  userName,
  isLoading = false,
  onConfirm,
  onCancel,
}: RemoveConfirmDialogProps) {
  return (
    <DeleteConfirmDialog
      isOpen={isOpen}
      title="Remove Member?"
      description="The member will lose access to this project immediately."
      itemName={userName}
      itemType="member"
      isLoading={isLoading}
      onConfirm={onConfirm}
      onCancel={onCancel}
      isDangerous={true}
    />
  );
}
