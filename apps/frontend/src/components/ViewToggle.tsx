import { useLocation, useNavigate } from 'react-router-dom';
import { Map as MapIcon, Grid3X3 } from 'lucide-react';

export function ViewToggle({ mode = 'route', showLabels = true, routeBase = '/stories' }: { mode?: 'route' | 'query'; showLabels?: boolean; routeBase?: string }) {
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);
  const isMap = (() => {
    if (mode === 'route') return location.pathname === routeBase && params.get('style') === 'map';
    return params.get('style') === 'map';
  })();

  const go = (target: 'map' | 'gallery') => {
    if (mode === 'route') {
      // Toggle between /stories and /stories?style=map
      let next = new URLSearchParams(params);
      // Save current scroll position when leaving gallery for map, so we can restore on return
      try {
        if (target === 'map') {
          sessionStorage.setItem(`scroll:${routeBase}`, String(window.scrollY));
        }
      } catch {}
      if (target === 'map') {
        // Build a fresh query: only mv + style=map, using the current URL mv at click time
        next = new URLSearchParams();
        try {
          const mv = params.get('mv');
          if (mv) {
            const parts = mv.split(',');
            const lat = parseFloat(parts[0] || '');
            const lng = parseFloat(parts[1] || '');
            const z = parseInt(parts[2] || '', 10);
            if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(z)) {
              sessionStorage.setItem('toggle:lastMapView', JSON.stringify({ center: { lat, lng }, zoom: z }));
              next.set('mv', `${lat.toFixed(5)},${lng.toFixed(5)},${Math.round(z)}`);
            }
          }
        } catch {}
        next.set('style', 'map');
      } else {
        // Going to gallery: snapshot current map view and write it into URL mv.
        // Do not trust any existing mv in the current URL.
        try {
          let snap: { center: { lat: number; lng: number }; zoom: number } | null = null;
          // Prefer live session view (current map state)
          const cRaw = sessionStorage.getItem('view:map:center');
          const zRaw = sessionStorage.getItem('view:map:zoom');
          if (cRaw && zRaw) {
            const c = JSON.parse(cRaw) as { lat: number; lng: number };
            const z = parseInt(zRaw, 10);
            if (c && !Number.isNaN(z)) snap = { center: c, zoom: z };
          }
          // Fallback to toggle snapshot
          if (!snap) {
            const saved = sessionStorage.getItem('toggle:lastMapView');
            if (saved) {
              const v = JSON.parse(saved) as { center: { lat: number; lng: number }; zoom: number };
              if (v && v.center && typeof v.center.lat === 'number' && typeof v.center.lng === 'number' && typeof v.zoom === 'number') {
                snap = v;
              }
            }
          }
          // As a last resort, peek mv from URL (legacy) just to avoid empty mv
          if (!snap) {
            const mv = params.get('mv');
            if (mv) {
              const parts = mv.split(',');
              const lat = parseFloat(parts[0] || '');
              const lng = parseFloat(parts[1] || '');
              const z = parseInt(parts[2] || '', 10);
              if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(z)) snap = { center: { lat, lng }, zoom: z };
            }
          }
          if (snap) {
            sessionStorage.setItem('toggle:lastMapView', JSON.stringify(snap));
            next.set('mv', `${snap.center.lat.toFixed(5)},${snap.center.lng.toFixed(5)},${Math.round(snap.zoom)}`);
          }
          // Always snapshot current bounds if available
          try {
            const bRaw = sessionStorage.getItem('view:map:bounds');
            if (bRaw) sessionStorage.setItem('toggle:lastMapBounds', bRaw);
          } catch {}
        } catch {}
        next.delete('style');
      }
      navigate({ pathname: routeBase, search: `?${next.toString()}` });
    } else {
      const next = new URLSearchParams(params);
      if (target === 'map') {
        // Query mode: use current URL mv at click time; write it to toggle snapshot and set style=map
        try {
          const mv = params.get('mv');
          if (mv) {
            const parts = mv.split(',');
            const lat = parseFloat(parts[0] || '');
            const lng = parseFloat(parts[1] || '');
            const z = parseInt(parts[2] || '', 10);
            if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(z)) {
              sessionStorage.setItem('toggle:lastMapView', JSON.stringify({ center: { lat, lng }, zoom: z }));
              next.set('mv', `${lat.toFixed(5)},${lng.toFixed(5)},${Math.round(z)}`);
            }
          }
        } catch {}
        next.set('style', 'map');
      } else {
        // Snapshot current map view when leaving to gallery and write mv into URL.
        // Do not use mv from current URL.
        try {
          let snap: { center: { lat: number; lng: number }; zoom: number } | null = null;
          // Prefer live session view (current map state)
          const cRaw = sessionStorage.getItem('view:map:center');
          const zRaw = sessionStorage.getItem('view:map:zoom');
          if (cRaw && zRaw) {
            const c = JSON.parse(cRaw) as { lat: number; lng: number };
            const z = parseInt(zRaw, 10);
            if (c && !Number.isNaN(z)) snap = { center: c, zoom: z };
          }
          // Fallback to toggle snapshot
          if (!snap) {
            const saved = sessionStorage.getItem('toggle:lastMapView');
            if (saved) {
              const v = JSON.parse(saved) as { center: { lat: number; lng: number }; zoom: number };
              if (v && v.center && typeof v.center.lat === 'number' && typeof v.center.lng === 'number' && typeof v.zoom === 'number') {
                snap = v;
              }
            }
          }
          // As a last resort, peek mv from URL (legacy) just to avoid empty mv
          if (!snap) {
            const mv = params.get('mv');
            if (mv) {
              const parts = mv.split(',');
              const lat = parseFloat(parts[0] || '');
              const lng = parseFloat(parts[1] || '');
              const z = parseInt(parts[2] || '', 10);
              if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(z)) snap = { center: { lat, lng }, zoom: z };
            }
          }
          if (snap) {
            sessionStorage.setItem('toggle:lastMapView', JSON.stringify(snap));
            next.set('mv', `${snap.center.lat.toFixed(5)},${snap.center.lng.toFixed(5)},${Math.round(snap.zoom)}`);
          }
          const bRaw = sessionStorage.getItem('view:map:bounds');
          if (bRaw) sessionStorage.setItem('toggle:lastMapBounds', bRaw);
        } catch {}
        next.delete('style');
      }
      navigate({ pathname: location.pathname, search: `?${next.toString()}` });
    }
  };

  return (
    <div className="inline-flex items-start rounded-full bg-white shadow-md border border-black/10 overflow-hidden select-none">
      <button
        className={`px-3 py-1.5 text-sm font-medium flex items-center ${isMap ? 'bg-brand text-white' : 'text-gray-700'}`}
        onClick={() => go('map')}
        aria-pressed={isMap}
      >
  <MapIcon size={16} className={showLabels ? 'mr-1.5' : ''} />
  {showLabels && <span>Carte</span>}
      </button>
      <button
        className={`px-3 py-1.5 text-sm font-medium flex items-center ${!isMap ? 'bg-brand text-white' : 'text-gray-700'}`}
        onClick={() => go('gallery')}
        aria-pressed={!isMap}
      >
  <Grid3X3 size={16} className={showLabels ? 'mr-1.5' : ''} />
  {showLabels && <span>Galerie</span>}
      </button>
    </div>
  );
}
