import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { List as ListIcon } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { ViewToggle } from '@/components/ViewToggle';
import OptionsPopover from '@/components/OptionsPopover';
import { useOptions } from '@/context/OptionsContext';
import { useReels } from '@/hooks/useReels';
import { useSearchFilter } from '@/hooks/useSearchFilter';
import { Map } from '@/components/Map';
import { Story } from '@/types/story';
import { SearchHeader } from '@/components/SearchHeader';
import { Plus, Minus } from 'lucide-react';

export default function ReelsPage() {
  const { data: stories } = useReels();
  const { showClosed, clusterAnim } = useOptions();
  const [params] = useSearchParams();
  const q = params.get('q');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const parseMv = () => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const mv = sp.get('mv');
      if (!mv) return null;
      const [latS, lngS, zS] = mv.split(',');
      const lat = parseFloat(latS); const lng = parseFloat(lngS); const z = parseInt(zS, 10);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(z)) return { center: { lat, lng }, zoom: z } as const;
    } catch {}
    return null;
  };
  const writeMv = (center: { lat: number; lng: number }, zoom: number) => {
    try { const sp = new URLSearchParams(window.location.search); sp.set('mv', `${center.lat.toFixed(5)},${center.lng.toFixed(5)},${Math.round(zoom)}`); window.history.replaceState({}, '', `${window.location.pathname}?${sp.toString()}`); } catch {}
  };
  const [mapView, setMapView] = useState<{ center: { lat: number; lng: number }; zoom: number }>(() => parseMv() || { center: { lat: 41.5, lng: 70 }, zoom: 3 });
  const isMap = (params.get('style') === 'map');

  const reels: Story[] = useMemo(() => {
    return (stories || []).filter(s => Boolean(s.postedDate) && (s.panels.find(p => p.type === 'video')));
  }, [stories]);

  const sf = params.get('sf') || 't,u,a,d,i';
  const fields = {
    title: sf.includes('t'),
    username: sf.includes('u'),
    address: sf.includes('a'),
    description: sf.includes('d'),
    images: sf.includes('i'),
  } as const;
  const { filtered, matchedPanelByStory } = useSearchFilter(reels, q, fields);
  let visible = q ? filtered : reels;
  if (!showClosed) visible = visible.filter(s => !s.isClosed);

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-3 left-3 right-3 z-[10000]">
        <SearchHeader 
          viewToggleMode="query" 
          showFilters={filtersOpen}
          onToggleFilters={() => setFiltersOpen(o => !o)}/>
      </div>

      {isMap && (
        <div className="flex h-screen w-full">
          <Map
            stories={visible.filter(s => s.geo)}
            onStorySelect={(story) => {
              const pid = q ? matchedPanelByStory[story.id] : undefined;
              const base = `/reel/${encodeURIComponent(story.handle || story.id)}`;
              const current = `${location.pathname}${location.search}`;
              const from = `from=${encodeURIComponent(current)}`;
              navigate(pid ? `${base}?${from}&panel=${encodeURIComponent(pid)}` : `${base}?${from}`);
            }}
            center={mapView.center}
            zoom={mapView.zoom}
            onViewChange={(c,z)=> { setMapView({ center: c, zoom: z }); writeMv(c, z); }}
            clusterAnimate={clusterAnim}
            fitPadding={80}
            centerOffsetPixels={{ x: 0, y: -95 }}
            offsetExternalCenter
          />
        </div>
      )}

      {!isMap && (
      <div className="mt-[85px] md:mt-12 p-6">
        <h2 className="text-2xl font-bold mb-4">Reels récents</h2>
        <div className="grid grid-cols-1 [@media(min-width:800px)]:grid-cols-3 xl:grid-cols-4 gap-6 w-full xl:max-w-[1460px] mx-auto">
          {visible.map((story) => (
            <button
              key={story.id}
              onClick={() => {
                const pid = q ? matchedPanelByStory[story.id] : undefined;
                const base = `/reel/${encodeURIComponent(story.handle || story.id)}`;
                const current = `${location.pathname}${location.search}`;
                const from = `from=${encodeURIComponent(current)}`;
                navigate(pid ? `${base}?${from}&panel=${encodeURIComponent(pid)}` : `${base}?${from}`);
              }}
              className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg group"
            >
              {story.thumbnail && (
                <img src={story.thumbnail} className={`w-full h-full object-cover ${story.isClosed ? 'grayscale' : ''}`} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg line-clamp-2 flex-1 text-left">{story.title}</h3>
                  {story.isClosed && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-red-600 text-white whitespace-nowrap">Fermé</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
