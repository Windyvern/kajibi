import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { List as ListIcon } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { ViewToggle } from '@/components/ViewToggle';
import OptionsPopover from '@/components/OptionsPopover';
import { useOptions } from '@/context/OptionsContext';
import { usePosts } from '@/hooks/usePosts';
import { useSearchFilter } from '@/hooks/useSearchFilter';
import { PostsMap } from '@/components/PostsMap';
import { PostsGallery } from '@/components/PostsGallery';
import { Story } from '@/types/story';
import { SearchHeader } from '@/components/SearchHeader';
import { Plus, Minus } from 'lucide-react';

// For now, posts are a subset of stories with a postedDate present and optionally a type marker
export default function PostsPage() {
  const { data: posts, isLoading, error } = usePosts();
  const { showClosed, clusterAnim } = useOptions();
  const [params] = useSearchParams();
  const q = params.get('q');
  const navigate = useNavigate();
  const location = useLocation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  
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
  const { filtered, matchedPanelByStory } = useSearchFilter(posts, q, fields);
  let visible = q ? filtered : posts;
  if (!showClosed) visible = visible.filter(s => !s.isClosed);

  // Add loading and error states
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Chargement des posts...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center text-red-600">
          <div className="text-lg">Erreur lors du chargement des posts</div>
          <div className="text-sm mt-2">{error.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-3 left-3 right-3 z-[10000]">
        <SearchHeader 
          viewToggleMode="query" 
          showFilters={filtersOpen}
          onToggleFilters={() => setFiltersOpen(o => !o)}/>
      </div>

            {/* Map view for posts with pins where geo exists (toggle) */}
      {isMap && (
        <div className="h-[100dvh]">
          <PostsMap
            posts={visible}
            onStorySelect={(story) => {
              const pid = q ? matchedPanelByStory[story.id] : undefined;
              const base = `/post/${encodeURIComponent(story.handle || story.id)}`;
              const current = `${location.pathname}${location.search}`;
              const from = `from=${encodeURIComponent(current)}`;
              
              // Store the complete sorted story list for swipe navigation
              try {
                sessionStorage.setItem('viewer:posts:orderedIds', JSON.stringify(visible.map(s => s.id)));
                sessionStorage.setItem('viewer:posts:context', 'map');
              } catch {}
              
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

      {/* Gallery list (toggle) */}
      {!isMap && (
        <div className="mt-[85px] md:mt-12">
          <PostsGallery
            posts={visible}
            onSelect={(story) => {
              const pid = q ? matchedPanelByStory[story.id] : undefined;
              const base = `/post/${encodeURIComponent(story.handle || story.id)}`;
              const current = `${location.pathname}${location.search}`;
              const from = `from=${encodeURIComponent(current)}`;
              
              // Store the complete sorted story list for swipe navigation
              try {
                sessionStorage.setItem('viewer:posts:orderedIds', JSON.stringify(visible.map(s => s.id)));
                sessionStorage.setItem('viewer:posts:context', 'gallery');
              } catch {}
              
              navigate(pid ? `${base}?${from}&panel=${encodeURIComponent(pid)}` : `${base}?${from}`);
            }}
          />
        </div>
      )}
    </div>
  );
}
