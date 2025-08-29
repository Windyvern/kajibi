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
import { ReelsMap } from '@/components/ReelsMap';
import { ReelsGallery } from '@/components/ReelsGallery';
import { Story } from '@/types/story';
import { SearchHeader } from '@/components/SearchHeader';
import { Plus, Minus } from 'lucide-react';

export default function ReelsPage() {
  const { data: reels } = useReels();
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
        <div className="h-[100dvh]">
          <ReelsMap
            reels={visible}
            onStorySelect={(story) => {
              const pid = q ? matchedPanelByStory[story.id] : undefined;
              const base = `/reel/${encodeURIComponent(story.handle || story.id)}`;
              const current = `${location.pathname}${location.search}`;
              const from = `from=${encodeURIComponent(current)}`;
              navigate(pid ? `${base}?${from}&panel=${encodeURIComponent(pid)}` : `${base}?${from}`);
            }}
            center={mapView.center}
            zoom={mapView.zoom}
            clusterAnimate={clusterAnim}
            fitPadding={80}
            onViewChange={(center, zoom) => {
              setMapView({ center, zoom });
              writeMv(center, zoom);
            }}
          />
        </div>
      )}

      {!isMap && (
        <div className="mt-[85px] md:mt-12">
          <ReelsGallery
            reels={visible}
            onSelect={(story) => {
              const pid = q ? matchedPanelByStory[story.id] : undefined;
              const base = `/reel/${encodeURIComponent(story.handle || story.id)}`;
              const current = `${location.pathname}${location.search}`;
              const from = `from=${encodeURIComponent(current)}`;
              navigate(pid ? `${base}?${from}&panel=${encodeURIComponent(pid)}` : `${base}?${from}`);
            }}
          />
        </div>
      )}
    </div>
  );
}
