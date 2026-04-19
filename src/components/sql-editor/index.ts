/**
 * SQL Editor Module
 * 
 * Exports all SQL editor components and hooks.
 */

// Main component (backward-compatible wrapper)
export { default as SqlEditor, type SqlEditorProps } from './SqlEditor';

// Core components

export { SyntaxHighlightedEditor, type SyntaxHighlightedEditorProps } from './SyntaxHighlightedEditor';
export { SqlEditorToolbar, type SqlEditorToolbarProps } from './SqlEditorToolbar';
export { SqlEditorFooter, type SqlEditorFooterProps, type FooterPanel } from './SqlEditorFooter';
export { FilePicker, type FilePickerProps } from './FilePicker';
export { SettingsPanel, type SettingsPanelProps } from './SettingsPanel';


// Hooks
export { useSqlEditor, type UseSqlEditorOptions, type UseSqlEditorReturn } from './hooks/useSqlEditor';
export { useFilePicker, type UseFilePickerOptions, type UseFilePickerReturn } from '@/lib/file-management/hooks/useFilePicker';
