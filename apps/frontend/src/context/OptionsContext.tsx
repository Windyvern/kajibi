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
  galleryMap: boolean; // Carte en vue Galerie
  setGalleryMap: (v: boolean) => void;
  // Progressive cluster build:
  // - Keeps UI responsive while adding thousands of markers by chunking work
  // - Clusters/counts appear progressively and stabilize on completion
  // - Leave disabled by default; wire to Leaflet.markercluster's chunkedLoading
  chunkedLoading: boolean;
  setChunkedLoading: (v: boolean) => void;
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
  const [clusterAnim, setClusterAnim] = useState<boolean>(stored?.clusterAnim ?? false);
  const [vegMode, setVegMode] = useState<VegMode>(stored?.vegMode ?? 'off');
  const [galleryMap, setGalleryMap] = useState<boolean>(stored?.galleryMap ?? true);
  const [chunkedLoading, setChunkedLoading] = useState<boolean>((stored as any)?.chunkedLoading ?? false);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ showClosed, darkMode, clusterAnim, vegMode, galleryMap, chunkedLoading }));
    } catch {}
  }, [showClosed, darkMode, clusterAnim, vegMode, galleryMap, chunkedLoading]);

  const value = useMemo<OptionsState>(() => ({
    showClosed,
    setShowClosed,
    darkMode,
    setDarkMode,
    clusterAnim,
    setClusterAnim,
    vegMode,
    setVegMode,
    galleryMap,
    setGalleryMap,
    chunkedLoading,
    setChunkedLoading,
  }), [showClosed, darkMode, clusterAnim, vegMode, galleryMap, chunkedLoading]);

  return (
    <OptionsContext.Provider value={value}>{children}</OptionsContext.Provider>
  );
};

export function useOptions() {
  const ctx = useContext(OptionsContext);
  if (!ctx) throw new Error('useOptions must be used within OptionsProvider');
  return ctx;
}
