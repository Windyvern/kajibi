import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type VegMode = 'off' | 'veg' | 'vegan';

interface OptionsState {
  showClosed: boolean; // true = show closed, false = hide closed
  setShowClosed: (v: boolean) => void;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  clusterAnim: boolean;
  setClusterAnim: (v: boolean) => void;
  vegMode: VegMode;
  setVegMode: (v: VegMode) => void;
}

const OptionsContext = createContext<OptionsState | undefined>(undefined);

const STORAGE_KEY = 'kajibi:options';

function readStored(): Partial<OptionsState> | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export const OptionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const stored = useMemo(() => readStored(), []);
  const [showClosed, setShowClosed] = useState<boolean>(stored?.showClosed ?? true);
  const [darkMode, setDarkMode] = useState<boolean>(stored?.darkMode ?? false);
  const [clusterAnim, setClusterAnim] = useState<boolean>(stored?.clusterAnim ?? true);
  const [vegMode, setVegMode] = useState<VegMode>(stored?.vegMode ?? 'off');

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ showClosed, darkMode, clusterAnim, vegMode }));
    } catch {}
  }, [showClosed, darkMode, clusterAnim, vegMode]);

  const value = useMemo<OptionsState>(() => ({
    showClosed,
    setShowClosed,
    darkMode,
    setDarkMode,
    clusterAnim,
    setClusterAnim,
    vegMode,
    setVegMode,
  }), [showClosed, darkMode, clusterAnim, vegMode]);

  return (
    <OptionsContext.Provider value={value}>{children}</OptionsContext.Provider>
  );
};

export function useOptions() {
  const ctx = useContext(OptionsContext);
  if (!ctx) throw new Error('useOptions must be used within OptionsProvider');
  return ctx;
}
