import React, { createContext, useContext, useState, ReactNode } from 'react';
import { getUserPreferences, updateUserPreferences } from '@/lib/cookies';

interface EditorSettings {
  showMinimap: boolean;
  showLineNumbers: boolean;
  wordWrap: boolean;
  bracketMatching: boolean;
  autoCloseBrackets: boolean;
  foldGutter: boolean;
  highlightActiveLine: boolean;
}

interface EditorSettingsContextType extends EditorSettings {
  setShowMinimap: (show: boolean) => void;
  setShowLineNumbers: (show: boolean) => void;
  setWordWrap: (wrap: boolean) => void;
  setBracketMatching: (enable: boolean) => void;
  setAutoCloseBrackets: (enable: boolean) => void;
  setFoldGutter: (enable: boolean) => void;
  setHighlightActiveLine: (enable: boolean) => void;
}

const EditorSettingsContext = createContext<EditorSettingsContextType | undefined>(undefined);

export function EditorSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<EditorSettings>(() => {
    const prefs = getUserPreferences();
    return {
      showMinimap: prefs.editorShowMinimap ?? true,
      showLineNumbers: prefs.editorShowLineNumbers ?? false, // Default to false as requested
      wordWrap: prefs.editorWordWrap ?? false,
      bracketMatching: prefs.editorBracketMatching ?? true,
      autoCloseBrackets: prefs.editorAutoCloseBrackets ?? true,
      foldGutter: prefs.editorFoldGutter ?? false, // Default to false as requested
      highlightActiveLine: prefs.editorHighlightActiveLine ?? true,
    };
  });

  const updateSetting = (key: keyof EditorSettings, cookieKey: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    updateUserPreferences({ [cookieKey]: value });
  };

  const setShowMinimap = (value: boolean) => updateSetting('showMinimap', 'editorShowMinimap', value);
  const setShowLineNumbers = (value: boolean) => updateSetting('showLineNumbers', 'editorShowLineNumbers', value);
  const setWordWrap = (value: boolean) => updateSetting('wordWrap', 'editorWordWrap', value);
  const setBracketMatching = (value: boolean) => updateSetting('bracketMatching', 'editorBracketMatching', value);
  const setAutoCloseBrackets = (value: boolean) => updateSetting('autoCloseBrackets', 'editorAutoCloseBrackets', value);
  const setFoldGutter = (value: boolean) => updateSetting('foldGutter', 'editorFoldGutter', value);
  const setHighlightActiveLine = (value: boolean) => updateSetting('highlightActiveLine', 'editorHighlightActiveLine', value);

  return (
    <EditorSettingsContext.Provider
      value={{
        ...settings,
        setShowMinimap,
        setShowLineNumbers,
        setWordWrap,
        setBracketMatching,
        setAutoCloseBrackets,
        setFoldGutter,
        setHighlightActiveLine,
      }}
    >
      {children}
    </EditorSettingsContext.Provider>
  );
}

export function useEditorSettings() {
  const context = useContext(EditorSettingsContext);
  if (context === undefined) {
    throw new Error('useEditorSettings must be used within an EditorSettingsProvider');
  }
  return context;
}
