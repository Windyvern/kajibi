import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LatestArticlesGallery } from '@/components/LatestArticlesGallery';
import { Map } from '@/components/Map';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { useStories } from '@/hooks/useStories';
import { Story } from '@/types/story';
import { Button } from '@/components/ui/button';
import { List as ListIcon } from 'lucide-react';
import { ViewToggle } from '@/components/ViewToggle';
import { SearchBar } from '@/components/SearchBar';
import { SearchHeader } from '@/components/SearchHeader';
import { useSearchFilter } from '@/hooks/useSearchFilter';
import OptionsPopover from '@/components/OptionsPopover';
import { useOptions } from '@/context/OptionsContext';

const GalleryPage = () => {
  const { data: stories, isLoading, error } = useStories();
  const [selected, setSelected] = useState<Story | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { showClosed, galleryMap, clusterAnim } = useOptions();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const listParam = params.get('list');
  const prizeParam = params.get('prize');
  const q = params.get('q');
  const isMap = params.get('style') === 'map';
  const selectedSlug = params.get('story');
  const selectedPanel = params.get('panel') || undefined;
  const selectedStory = selectedSlug ? (stories || []).find(s => (s.handle || s.id).toLowerCase() === selectedSlug.toLowerCase()) || null : null;
  // Parse mv/+persist regardless of mode to keep hooks order stable
  const parseMv = () => {
    try {
      const mv = params.get('mv');
      if (!mv) return null;
      const [latS, lngS, zS] = mv.split(',');
      const lat = parseFloat(latS); const lng = parseFloat(lngS); const z = parseInt(zS, 10);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(z)) return { center: { lat, lng }, zoom: z } as const;
    } catch {}
    return null;
  };
  const [mapView, setMapView] = useState<{ center: { lat: number; lng: number }; zoom: number }>(() => parseMv() || { center: { lat: 41.5, lng: 70 }, zoom: 3 });
  // Debounced mv writer to avoid spamming navigate during wheel zoom in map-in-gallery mode
  const mvTimerRef = useRef<number | null>(null);
  const prevMvRef = useRef<string | null>(null);
  const writeMv = (center: { lat: number; lng: number }, zoom: number) => {
    try {
      const nextMv = `${center.lat.toFixed(5)},${center.lng.toFixed(5)},${Math.round(zoom)}`;
      if (prevMvRef.current === nextMv) return;
      if (mvTimerRef.current) window.clearTimeout(mvTimerRef.current);
      mvTimerRef.current = window.setTimeout(() => {
        try {
          const latest = new URL(window.location.href);
          const params = latest.searchParams;
          params.set('mv', nextMv);
          window.history.replaceState({}, '', `${latest.pathname}?${params.toString()}`);
          prevMvRef.current = nextMv;
        } catch {}
      }, 200);
    } catch {}
  };

  useEffect(() => () => { if (mvTimerRef.current) window.clearTimeout(mvTimerRef.current); }, []);
  // Restore scroll if returning from a story in gallery context
  const locKey = `${location.pathname}${location.search}`;
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(`scroll:${locKey}`);
      if (v) {
        window.requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(v, 10) || 0);
          sessionStorage.removeItem(`scroll:${locKey}`);
        });
      }
    } catch {}
  }, [locKey]);

  // Restore scroll when returning from map view toggle
  useEffect(() => {
    try {
      const k = `scroll:/stories`;
      const v = sessionStorage.getItem(k);
      if (v) {
        window.requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(v, 10) || 0);
          sessionStorage.removeItem(k);
        });
      }
    } catch {}
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span>Loading gallery…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span>Failed to load gallery</span>
      </div>
    );
  }

  if (!stories || stories.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span>No articles available</span>
      </div>
    );
  }

  // Filter stories by list if list param is present
  let baseStories = stories || [];
  if (listParam) {
    baseStories = baseStories.filter((s) => (s.lists || []).some((l) => (l.slug || l.id) === listParam));
  }
  if (prizeParam) {
    baseStories = baseStories.filter((s) => (s.prizes || []).some((p) => (p.slug || p.id) === prizeParam));
  }
  const sf = params.get('sf') || 't,u,a,d,i';
  const fields = {
    title: sf.includes('t'),
    username: sf.includes('u'),
    address: sf.includes('a'),
    description: sf.includes('d'),
    images: sf.includes('i'),
  } as const;
  const { filtered, matchedPanelByStory, scores } = useSearchFilter(baseStories, q, fields);
  let displayedStories = q ? filtered : baseStories;
  if (!showClosed) displayedStories = displayedStories.filter(s => !s.isClosed);

  // Read last map zoom to decide default vs focused view
  let lastZoom: number | null = null;
  try {
    const zRaw = sessionStorage.getItem('view:map:zoom');
    if (zRaw) lastZoom = parseInt(zRaw, 10);
  } catch {}

  // Build optional sections: visible on map first (only for zoom >= 6), then recent stories
  let sections: Array<{ title: string; stories: Story[] }> | undefined;
  try {
    const bRaw = sessionStorage.getItem('view:map:bounds');
    if (bRaw) {
      const b = JSON.parse(bRaw) as { north: number; south: number; east: number; west: number };
      const inBounds: Story[] = [];
      const outBounds: Story[] = [];
      for (const s of displayedStories) {
        const g = s.geo;
        if (g && g.lat <= b.north && g.lat >= b.south && g.lng <= b.east && g.lng >= b.west) inBounds.push(s); else outBounds.push(s);
      }
      const showInBounds = (lastZoom != null) && (lastZoom >= 6);
      if (showInBounds && inBounds.length > 0) {
        const outSorted = [...outBounds].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        sections = [
          { title: 'Adresses visibles sur la carte', stories: inBounds },
          { title: 'Stories récentes', stories: outSorted },
        ];
      } else {
        // Default zoom: show most recent overall
        displayedStories = [...displayedStories].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      }
    } else {
      // No bounds available: default to most recent
      displayedStories = [...displayedStories].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    }
  } catch {
    // On error, default to most recent
    displayedStories = [...displayedStories].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  const listTitle = (() => {
    if (listParam) {
      for (const s of stories || []) {
        const m = (s.lists || []).find((l) => (l.slug || l.id) === listParam);
        if (m?.name) return m.name;
      }
      return listParam;
    }
    if (prizeParam) {
      for (const s of stories || []) {
        const p = (s.prizes || []).find((p) => (p.slug || p.id) === prizeParam);
        if (p?.name) return p.name;
      }
      return prizeParam;
    }
    return null;
  })();

  // Map view: full height map with fixed header
  if (isMap) {
    const selectedSlug = params.get('story');
    const selectedPanel = params.get('panel') || undefined;
    const selectedStory = selectedSlug ? (stories || []).find(s => (s.handle || s.id).toLowerCase() === selectedSlug.toLowerCase()) || null : null;
    // When selected story changes in map mode, center to it
    useEffect(() => {
      if (selectedStory?.geo) {
        setMapView({ center: selectedStory.geo, zoom: 16 });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStory?.id]);
    return (
      <div className="min-h-screen bg-background">
        <div className="fixed top-3 left-3 right-3 z-[11000]" data-lov-id="src/pages/Gallery.tsx:145:6">
          <SearchHeader
            dataLovId="src/pages/Gallery.tsx:145:6"
            viewToggleMode="route"
            showFilters={filtersOpen}
            onToggleFilters={() => setFiltersOpen(o => !o)}
            listsButtonVariant="outline"
          />
        </div>
        <div className="h-[100svh] w-full">
          <Map
            stories={displayedStories.filter(s => s.geo)}
            onStorySelect={(story) => {
              const pid = q ? matchedPanelByStory[story.id] : undefined;
              const next = new URLSearchParams(location.search);
              next.set('style', 'map');
              next.set('story', (story.handle || story.id));
              if (pid) next.set('panel', pid); else next.delete('panel');
              const from = params.get('from');
              if (from) next.set('from', from);
              navigate({ pathname: location.pathname, search: `?${next.toString()}` });
            }}
            center={mapView.center}
            zoom={mapView.zoom}
            onViewChange={(c,z)=> { setMapView({ center: c, zoom: z }); writeMv(c, z); }}
            fitPadding={80}
            centerOffsetPixels={{ x: 0, y: -95 }}
            selectedStoryId={selectedStory?.id}
            clusterAnimate={clusterAnim}
          />
          {selectedStory && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-[12000]">
              <div style={{ width: '56.25vh', height: '100vh' }} className="pointer-events-auto">
                <TwoPanelStoryViewer
                  initialStoryId={selectedStory.id}
                  initialPanelId={selectedPanel}
                  stories={displayedStories}
                  onClose={() => {
                    const next = new URLSearchParams(location.search);
                    next.delete('story');
                    next.delete('panel');
                    navigate({ pathname: location.pathname, search: `?${next.toString()}` });
                  }}
                  hideRightPanel
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background mt-[85px] md:mt-12">
      {/* Responsive header with padding around search */}
      <div className="fixed top-3 left-3 right-3 z-[11000]" data-lov-id="src/pages/Gallery.tsx:145:6">
        <SearchHeader
          dataLovId="src/pages/Gallery.tsx:145:6"
          viewToggleMode="route"
          showFilters={filtersOpen}
          onToggleFilters={() => setFiltersOpen(o => !o)}
          listsButtonVariant="outline"
        />
      </div>

      {(listParam || prizeParam || q) && (
        <div className="px-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">
              {listTitle || 'Résultats'}
              {q && (
                <span className="ml-2 text-base text-muted-foreground">({displayedStories.length} résultat{displayedStories.length !== 1 ? 's' : ''})</span>
              )}
            </h2>
            <button
              onClick={() => navigate('/stories')}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              × Fermer
            </button>
          </div>
        </div>
      )}

      <LatestArticlesGallery
        stories={sections ? undefined : displayedStories}
        sections={sections}
        onSelect={(story) => {
          const pid = q ? matchedPanelByStory[story.id] : undefined;
          const current = `${location.pathname}${location.search}`;
          try { sessionStorage.setItem(`scroll:${current}`, String(window.scrollY)); } catch {}
          if (story.geo && galleryMap) {
            const next = new URLSearchParams(location.search);
            next.set('style', 'map');
            next.set('story', (story.handle || story.id));
            if (pid) next.set('panel', pid); else next.delete('panel');
            next.set('from', encodeURIComponent(current));
            navigate({ pathname: '/stories', search: `?${next.toString()}` });
          } else {
            const base = `/story/${encodeURIComponent(story.handle || story.id)}`;
            const from = `from=${encodeURIComponent(current)}`;
            navigate(pid ? `${base}?${from}&panel=${encodeURIComponent(pid)}` : `${base}?${from}`);
          }
        }}
      />

      {/* Viewer is now handled by /story/:slug route */}
    </div>
  );
};

export default GalleryPage;
