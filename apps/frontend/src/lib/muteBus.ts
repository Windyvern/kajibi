// Simple global mute state with pub/sub and session persistence
type MuteListener = (muted: boolean) => void;

const STORAGE_KEY = 'storyViewer:muted';

export function getMute(): boolean {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (v === 'false') return false;
    if (v === 'true') return true;
  } catch {}
  return true; // default muted
}

export function setMute(muted: boolean) {
  try { sessionStorage.setItem(STORAGE_KEY, String(muted)); } catch {}
  try {
    const evt = new CustomEvent('global:mute-change', { detail: { muted } });
    window.dispatchEvent(evt);
  } catch {}
}

export function subscribeMute(listener: MuteListener) {
  const handler = (e: Event) => {
    // @ts-ignore CustomEvent detail
    const m = (e as CustomEvent)?.detail?.muted;
    if (typeof m === 'boolean') listener(m);
  };
  window.addEventListener('global:mute-change', handler as EventListener);
  return () => window.removeEventListener('global:mute-change', handler as EventListener);
}

