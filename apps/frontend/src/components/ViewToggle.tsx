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
      const next = new URLSearchParams(params);
      // Save current scroll position when leaving gallery for map, so we can restore on return
      try {
        if (target === 'map') {
          sessionStorage.setItem(`scroll:${routeBase}`, String(window.scrollY));
        }
      } catch {}
      if (target === 'map') {
        // Always prefer the latest map view from session when returning to map
        try {
          const cRaw = sessionStorage.getItem('view:map:center');
          const zRaw = sessionStorage.getItem('view:map:zoom');
          if (cRaw && zRaw) {
            const c = JSON.parse(cRaw) as { lat: number; lng: number };
            const z = parseInt(zRaw, 10);
            if (c && !Number.isNaN(z)) next.set('mv', `${c.lat.toFixed(5)},${c.lng.toFixed(5)},${Math.round(z)}`);
          }
        } catch {}
        // Ensure we land on the plain map, not a specific story viewer
        next.delete('story');
        next.delete('panel');
        next.set('style', 'map');
      } else {
        // Going to gallery: carry the latest map view into URL as mv too
        try {
          const cRaw = sessionStorage.getItem('view:map:center');
          const zRaw = sessionStorage.getItem('view:map:zoom');
          if (cRaw && zRaw) {
            const c = JSON.parse(cRaw) as { lat: number; lng: number };
            const z = parseInt(zRaw, 10);
            if (c && !Number.isNaN(z)) next.set('mv', `${c.lat.toFixed(5)},${c.lng.toFixed(5)},${Math.round(z)}`);
          }
        } catch {}
        next.delete('style');
      }
      navigate({ pathname: routeBase, search: `?${next.toString()}` });
    } else {
      const next = new URLSearchParams(params);
      if (target === 'map') next.set('style', 'map'); else next.delete('style');
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
