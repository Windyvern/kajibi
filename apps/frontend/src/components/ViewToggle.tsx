import { useLocation, useNavigate } from 'react-router-dom';
import { Map as MapIcon, Grid3X3 } from 'lucide-react';

export function ViewToggle({ mode = 'route', showLabels = true }: { mode?: 'route' | 'query'; showLabels?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);
  const isMap = (() => {
    if (mode === 'route') return location.pathname.startsWith('/map');
    return params.get('style') === 'map';
  })();

  const go = (target: 'map' | 'gallery') => {
    if (mode === 'route') {
      // Preserve query params while switching between /map and /gallery
      const next = new URLSearchParams(params);
      if (target === 'map' && !next.get('mv')) {
        try {
          const cRaw = sessionStorage.getItem('view:map:center');
          const zRaw = sessionStorage.getItem('view:map:zoom');
          if (cRaw && zRaw) {
            const c = JSON.parse(cRaw) as { lat: number; lng: number };
            const z = parseInt(zRaw, 10);
            if (c && !Number.isNaN(z)) next.set('mv', `${c.lat.toFixed(5)},${c.lng.toFixed(5)},${Math.round(z)}`);
          }
        } catch {}
      }
      const path = target === 'map' ? '/map' : '/gallery';
      navigate({ pathname: path, search: `?${next.toString()}` });
    } else {
      const next = new URLSearchParams(params);
      if (target === 'map') next.set('style', 'map'); else next.delete('style');
      navigate({ pathname: location.pathname, search: `?${next.toString()}` });
    }
  };

  return (
    <div className="inline-flex items-start rounded-full bg-white shadow-md border border-black/10 overflow-hidden select-none">
      <button
        className={`px-3 py-1.5 text-sm font-medium flex items-center ${isMap ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
        onClick={() => go('map')}
        aria-pressed={isMap}
      >
  <MapIcon size={16} className={showLabels ? 'mr-1.5' : ''} />
  {showLabels && <span>Carte</span>}
      </button>
      <button
        className={`px-3 py-1.5 text-sm font-medium flex items-center ${!isMap ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
        onClick={() => go('gallery')}
        aria-pressed={!isMap}
      >
  <Grid3X3 size={16} className={showLabels ? 'mr-1.5' : ''} />
  {showLabels && <span>Galerie</span>}
      </button>
    </div>
  );
}
