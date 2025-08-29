
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Map } from '@/components/Map';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { RestaurantCards } from '@/components/RestaurantCards';
import { StoryMetadata } from '@/components/StoryMetadata';
import { useStories } from '@/hooks/useStories';
import { Story } from '@/types/story';
import { X, List, Loader2, Plus, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/SearchBar';
import { useSearchFilter } from '@/hooks/useSearchFilter';
import { ViewToggle } from '@/components/ViewToggle';
import OptionsPopover from '@/components/OptionsPopover';
import { SearchHeader } from '@/components/SearchHeader';
import { useOptions } from '@/context/OptionsContext';

const MapView = () => {
  const { data: stories, isLoading, error } = useStories();
  const [params] = useSearchParams();
  const prizeParam = params.get('prize');
  // Search params (single hook instance used everywhere)
  const q = params.get('q');
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<string | undefined>(undefined);
  // Fit-to-results bounds (precise fit) when user presses Enter in search
  const [fitToBounds, setFitToBounds] = useState<[[number, number],[number, number]] | undefined>(undefined);
  useEffect(() => { setFitToBounds(undefined); }, [selectedStory?.id, q]);
  const [showMobileList, setShowMobileList] = useState(false);
  // Initial /map view to show France (left) and Japan (right) with margins per layout
  const parseMv = () => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const mv = sp.get('mv');
      if (!mv) return null;
      const [latS, lngS, zS] = mv.split(',');
      const lat = parseFloat(latS);
      const lng = parseFloat(lngS);
      const z = parseInt(zS, 10);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(z)) {
        return { center: { lat, lng }, zoom: z } as const;
      }
    } catch {}
    return null;
  };

  // Debounced mv writer to avoid spamming navigate during wheel zoom
  const mvTimerRef = useRef<number | null>(null);
  const prevMvRef = useRef<string | null>(null);
  const writeMv = (center: { lat: number; lng: number }, zoom: number) => {
    try {
      const current = new URL(window.location.href);
      const sp = current.searchParams;
      const nextMv = `${center.lat.toFixed(5)},${center.lng.toFixed(5)},${Math.round(zoom)}`;
      if (prevMvRef.current === nextMv) return; // no change
      if (mvTimerRef.current) window.clearTimeout(mvTimerRef.current);
      mvTimerRef.current = window.setTimeout(() => {
        try {
          const latest = new URL(window.location.href);
          const params = latest.searchParams;
          params.set('mv', nextMv);
          window.history.replaceState({}, '', `${latest.pathname}?${params.toString()}`);
          prevMvRef.current = nextMv;
        } catch {}
      }, 200); // debounce delay
    } catch {}
  };

  useEffect(() => () => { if (mvTimerRef.current) window.clearTimeout(mvTimerRef.current); }, []);

  const computeInitialView = () => {
    // 1) Respect explicit mv param if present in URL
    try {
      const sp = new URLSearchParams(window.location.search);
      const mv = sp.get('mv');
      if (mv) {
        const [latS, lngS, zS] = mv.split(',');
        const lat = parseFloat(latS);
        const lng = parseFloat(lngS);
        const z = parseInt(zS, 10);
        if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(z)) {
          return { center: { lat, lng }, zoom: z } as const;
        }
      }
    } catch {}
    try {
      // Treat hard reloads as a fresh instance: ignore persisted view
      const nav = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined);
      const isReload = nav?.type === 'reload';
      if (!isReload) {
        const fromUrl = parseMv();
        if (fromUrl) return fromUrl;
      }
      const savedC = isReload ? null : sessionStorage.getItem('view:map:center');
      const savedZ = isReload ? null : sessionStorage.getItem('view:map:zoom');
      if (savedC && savedZ) {
        const c = JSON.parse(savedC);
        const z = parseInt(savedZ, 10);
        if (c && typeof c.lat === 'number' && typeof c.lng === 'number' && !Number.isNaN(z)) {
          return { center: c, zoom: z };
        }
      }
    } catch {}
    const aspect = window.innerWidth / window.innerHeight;
    const center = { lat: 41.5, lng: 70 }; // midpoint across FR-JP
    const zoom = aspect >= 1.4 ? 3 : aspect >= 0.8 ? 2 : 2;
    return { center, zoom };
  };
  const [mapView, setMapView] = useState<{ center: { lat: number; lng: number }; zoom: number }>(() => computeInitialView());
  // Remember the last selected pin view so we can restore it on close
  const lastPinViewRef = useRef<{ center: { lat: number; lng: number }; zoom: number } | null>(null);
  // Track viewport to trigger re-render on resize and switch layouts live
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Ensure body styles are normalized when landing on map view after viewer
  useEffect(() => {
    try {
      const { body, documentElement } = document;
      body.style.overflow = '';
      documentElement.style.overflow = '';
      body.style.position = '';
      body.style.width = '';
      (body.style as any).touchAction = '';
    } catch {}
  }, []);
  const { showClosed, clusterAnim } = useOptions();
  // Build viewer order based on current bounds: in-bounds first, then recents
  const getViewerStories = (arr: Story[]) => getPrioritizedStories(arr);

  // Rotate a story array so selected appears first (stable order otherwise)
  const withSelectedFirst = (arr: Story[], sel?: Story | null) => {
    if (!sel) return arr;
    const idx = arr.findIndex(s => s.id === sel.id);
    if (idx > 0) return [...arr.slice(idx), ...arr.slice(0, idx)];
    return arr;
  };
  // Build prioritized story ordering for viewer: in-bounds first (if zoom>=6), then recent
  const getPrioritizedStories = (arr: Story[]) => {
    try {
      const lastZ = mapView.zoom;
      const bRaw = sessionStorage.getItem('view:map:bounds');
      if (bRaw && lastZ != null && lastZ >= 6) {
        const b = JSON.parse(bRaw) as { north: number; south: number; east: number; west: number };
        const withGeo = arr.filter(s => s.geo);
        const inBounds: Story[] = [];
        const outBounds: Story[] = [];
        for (const s of withGeo) {
          const g = s.geo!;
          if (g.lat <= b.north && g.lat >= b.south && g.lng <= b.east && g.lng >= b.west) inBounds.push(s); else outBounds.push(s);
        }
        const outSorted = [...outBounds].sort((a,b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        return [...inBounds, ...outSorted];
      }
    } catch {}
    return arr;
  };
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // Keep the initial FR-JP view; do not auto-refit

  const lastSelectSourceRef = useRef<string | undefined>(undefined);
  const handleStorySelect = (story: Story, meta?: { source?: string }) => {
    setSelectedStory(story);
    lastSelectSourceRef.current = meta?.source;
    // If coming from a search hit, prefer the matched panel; otherwise clear
    const pid = q ? matchedPanelByStory[story.id] : undefined;
    setSelectedPanelId(pid);

    setShowMobileList(false);

    // Update URL query params for deep link (preserve matched panel when available)
    const slug = encodeURIComponent(story.handle || story.id);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('story', slug);
    if (pid) newUrl.searchParams.set('panel', pid);
    else newUrl.searchParams.delete('panel');
    // Insert a base state (same page without viewer) before pushing the viewer state,
    // so a single back-swipe closes the viewer instead of navigating away
    try {
      const base = new URL(window.location.href);
      base.searchParams.delete('story');
      base.searchParams.delete('panel');
      window.history.pushState({ viewer: 'base' }, '', base.toString());
      window.history.pushState({ viewer: 'story' }, '', newUrl.toString());
    } catch {}

    // Center and zoom the map to the story pin only when triggered by a marker click on non-mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (story.geo && meta?.source === 'marker' && !isMobile) {
      const view = { center: story.geo, zoom: 16 } as const;
      lastPinViewRef.current = view;
      setMapView(view);
    }
  };

  const handleCloseStory = () => {
    const from = params.get('from');
    if (from) {
      navigate(decodeURIComponent(from));
      return;
    }
    setSelectedStory(null);
    // Restore the last pin view at street level, ignoring neighbors
    if (lastPinViewRef.current) {
      setMapView(lastPinViewRef.current);
    }
    // Clean URL deep-link params when closing inline
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('story');
    newUrl.searchParams.delete('panel');
    window.history.replaceState({}, '', newUrl.toString());
  };

  // Close the story viewer when the URL no longer has ?story=...
  useEffect(() => {
    const slug = params.get('story');
    if (!slug && selectedStory) {
      setSelectedStory(null);
      setSelectedPanelId(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('story')]);

  // Intercept back-swipe/popstate: when a story is open, close it instead of leaving the page
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if (selectedStory) {
        handleCloseStory();
        // Ensure URL has no story/panel query after closing
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('story');
          url.searchParams.delete('panel');
          window.history.replaceState({}, '', url.toString());
        } catch {}
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [selectedStory]);

  // Close with Escape key when a story is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedStory) handleCloseStory();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedStory]);

  // Compute search filtering (before any early returns to keep hooks order stable)
  const sf = params.get('sf') || 't,u,a,d,i';
  const fields = {
    title: sf.includes('t'),
    username: sf.includes('u'),
    address: sf.includes('a'),
    description: sf.includes('d'),
    images: sf.includes('i'),
  } as const;
  const { filtered, matchedPanelByStory, strongMatchStoryId } = useSearchFilter(stories, q, fields);
  let visibleStories = q ? filtered : (stories || []);
  if (prizeParam) {
    visibleStories = visibleStories.filter((s) => (s.prizes || []).some((p) => (p.slug || p.id) === prizeParam));
  }
  if (!showClosed) {
    visibleStories = visibleStories.filter((s) => !s.isClosed);
  }

  // Center/zoom on strong match only for sufficiently specific queries (>=3 chars)
  // This runs as the user types, without requiring Enter
  useEffect(() => {
    if (!q || q.length < 3 || !strongMatchStoryId) return;
    const st = (stories || []).find(s => s.id === strongMatchStoryId);
    if (st?.geo) setMapView({ center: st.geo, zoom: 16 });
  }, [q, strongMatchStoryId]);

  // Fit to results when user presses Enter and results are relatively few (<10)
  useEffect(() => {
    const fit = params.get('fit');
    if (fit !== '1') return;
    const arr = (q ? filtered : stories) || [];
    const withGeo = arr.filter(s => s.geo);
    if (withGeo.length > 0 && withGeo.length < 10) {
      let minLat = withGeo[0]!.geo!.lat, maxLat = withGeo[0]!.geo!.lat;
      let minLng = withGeo[0]!.geo!.lng, maxLng = withGeo[0]!.geo!.lng;
      withGeo.forEach(s => { const g = s.geo!; minLat = Math.min(minLat, g.lat); maxLat = Math.max(maxLat, g.lat); minLng = Math.min(minLng, g.lng); maxLng = Math.max(maxLng, g.lng); });
      const center = { lat: (minLat + maxLat)/2, lng: (minLng + maxLng)/2 };
      setMapView(v => ({ ...v, center }));
    }
  }, [params.get('fit')]);

  // Only recenter when selection came from a marker on non-mobile
  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) return;
    if (selectedStory?.geo && lastSelectSourceRef.current === 'marker') {
      const c = selectedStory.geo;
      setMapView({ center: c, zoom: 16 });
      try { writeMv(c, 16); } catch {}
    }
  }, [selectedStory?.id])

  // When mv param changes, always refresh the map view to mv
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const mv = sp.get('mv');
      if (mv) {
        const [latS, lngS, zS] = mv.split(',');
        const lat = parseFloat(latS);
        const lng = parseFloat(lngS);
        const z = parseInt(zS, 10);
        if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(z)) {
          setMapView({ center: { lat, lng }, zoom: z });
        }
      }
    } catch {}
  }, [params.get('mv')]);

  // Select story by ?story=slug on first load; honor optional ?panel=<panelId>
  useEffect(() => {
    if (!stories) return;
    const slug = params.get('story');
    const panel = params.get('panel') || undefined;
    if (slug && !selectedStory) {
      const found = stories.find((s) => (s.handle || '').toLowerCase() === slug.toLowerCase());
      if (found) {
        setSelectedStory(found);
        if (panel) setSelectedPanelId(panel);
        // Do not recenter the map on mobile when opening from URL
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        if (!isMobile && found.geo) setMapView({ center: found.geo, zoom: 16 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin" size={24} />
          <span>Loading stories...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl mb-2">Error loading stories</h2>
          <p className="text-gray-600">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  

  if (!stories || stories.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl mb-2">No stories found</h2>
          <p className="text-gray-600">Check back later for new content</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Responsive Header: Zoom +/- (left), Search (center), Nav (right) */}
      {!selectedStory && (
        <div className="fixed top-3 left-3 right-3 z-[10000]">
          <SearchHeader
            dataLovId="src/pages/MapView.tsx:231:8"
            viewToggleMode="route"
            showFilters={filtersOpen}
            onToggleFilters={() => setFiltersOpen(o => !o)}
            leftSlot={(
              <div className="flex flex-col items-start gap-1">
              </div>
            )}
          />
        </div>
      )}
      {/* Mobile Layout (rendered conditionally to avoid double-mount) */}
      {viewport.w < 768 && (
        selectedStory ? (
          <div className="relative min-h-screen">
            <TwoPanelStoryViewer 
              initialStoryId={selectedStory.id}
              initialPanelId={selectedPanelId}
              stories={stories}
              onClose={handleCloseStory}
            />
          </div>
        ) : (
          <div className="relative h-[100dvh]">
            {showMobileList ? (
              <div className="h-full overflow-y-auto bg-white p-4">
                <h2 className="text-xl font-bold mb-4">Stories</h2>
                <div className="space-y-4">
                  {visibleStories.map((story) => (
                    <button
                      key={story.id}
                      onClick={() => handleStorySelect(story)}
                      className="w-full text-left p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex gap-3">
                        {story.thumbnail && (
                          <img
                            src={story.thumbnail}
                            alt={story.title}
                            className="w-16 h-16 rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{story.title}</h3>
                          <p className="text-sm text-gray-600">{story.handle}</p>
                          <p className="text-xs text-gray-500 mt-1">{story.address}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full">
                <Map
                  stories={visibleStories}
                  onStorySelect={handleStorySelect}
                  selectedStoryId={selectedStory?.id}
                  center={{ lat:  mapView.center.lat, lng: mapView.center.lng }}
                  zoom={mapView.zoom}
                  onViewChange={(c, z) => { setMapView({ center: c, zoom: z }); writeMv(c, z); }}
                  onBoundsChange={(b) => {
                    try { sessionStorage.setItem('view:map:bounds', JSON.stringify(b)); } catch {}
                  }}
                  fitPadding={40}
                  clusterAnimate={clusterAnim}
                  centerOffsetPixels={{ x: 0, y: -60 }}
                />
                {/* Mobile-only zoom controls: bottom-right vertical + / - */}
                <div className="pointer-events-none absolute bottom-4 right-3 flex flex-col gap-2 mb-4 z-[12000]">
                  <button
                    onClick={() => setMapView(v => ({ ...v, zoom: Math.max(3, Math.min(19, v.zoom + 1)) }))}
                    className="pointer-events-auto h-12 w-12 rounded-full bg-white shadow-md border border-black/10 flex items-center justify-center"
                    aria-label="Zoom in"
                  >
                    <Plus size={18} />
                  </button>
                  <button
                    onClick={() => setMapView(v => ({ ...v, zoom: Math.max(3, Math.min(19, v.zoom - 1)) }))}
                    className="pointer-events-auto h-12 w-12 rounded-full bg-white shadow-md border border-black/10 flex items-center justify-center"
                    aria-label="Zoom out"
                  >
                    <Minus size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* Desktop Layout - Aspect-driven (rendered conditionally) */}
      {viewport.w >= 768 && (
      <div className="flex h-screen w-full">
        {(viewport.w / viewport.h >= 1.4) ? (
          // Wide screens
          selectedStory ? (
            selectedStory.geo ? (
            <div className="grid w-full h-full bg-white" style={{ gridTemplateColumns: '1fr 56.25vh 56.25vh minmax(0,56.25vh) 1fr' }}>
              {/* Left: map spans 1fr + spacer (to balance right description width) */}
              <div className="col-span-2 min-w-0">
                <Map
                  stories={visibleStories}
                  onStorySelect={handleStorySelect}
                  selectedStoryId={selectedStory?.id}
                  center={{ lat:  mapView.center.lat, lng: mapView.center.lng }}
                  zoom={mapView.zoom}
                  onViewChange={(c, z) => { setMapView({ center: c, zoom: z }); writeMv(c, z); }}
                  onBoundsChange={(b) => {
                    try { sessionStorage.setItem('view:map:bounds', JSON.stringify(b)); } catch {}
                  }}
                  clusterAnimate={clusterAnim}
                  centerOffsetPixels={{ x: 0, y: -95 }}
                />
              </div>

              {/* Center viewer: fixed 9:16 in middle column */}
              <div className="flex items-center justify-center" style={{ height: '100vh' }}>
                <div style={{ width: '56.25vh', height: '100vh' }}>
                  <TwoPanelStoryViewer
                    initialStoryId={selectedStory.id}
                    initialPanelId={selectedPanelId}
                    stories={stories}
                    onClose={handleCloseStory}
                    hideMetadataPanel
                    hideRightPanel
                  />
                </div>
              </div>

              {/* Right description: fixed width equal to viewer */}
              <div className="bg-white relative">
                <button
                  onClick={handleCloseStory}
                  className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center"
                  aria-label="Fermer"
                >
                  <X size={22} />
                </button>
                <div className="h-full">
                  <StoryMetadata
                    story={selectedStory}
                    currentPanel={selectedStory.panels[0]}
                  />
                </div>
              </div>

              {/* Far right: blank space */}
              <div className="bg-white" />
            </div>
            ) : (
              // No geo: center viewer + description (both equal width) with whitespace sides
              <div className="grid w-full h-full bg-white" style={{ gridTemplateColumns: '1fr 56.25vh minmax(0,56.25vh) 1fr' }}>
                <div />
                <div className="flex items-center justify-center" style={{ height: '100vh' }}>
                  <div style={{ width: '56.25vh', height: '100vh' }}>
                    <TwoPanelStoryViewer
                      initialStoryId={selectedStory.id}
                      initialPanelId={selectedPanelId}
                      stories={stories}
                      onClose={handleCloseStory}
                      hideMetadataPanel
                      hideRightPanel
                    />
                  </div>
                </div>
                <div className="bg-white relative">
                  <button
                    onClick={handleCloseStory}
                    className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center"
                    aria-label="Fermer"
                  >
                    <X size={22} />
                  </button>
                  <div className="h-full">
                    <StoryMetadata
                      story={selectedStory}
                      currentPanel={selectedStory.panels[0]}
                    />
                  </div>
                </div>
                <div />
              </div>
            )
          ) : (
            <div className="w-full h-full">
              <Map
                stories={visibleStories}
                onStorySelect={handleStorySelect}
                selectedStoryId={undefined}
                center={{ lat:  mapView.center.lat, lng: mapView.center.lng }}
                zoom={mapView.zoom}
                onViewChange={(c, z) => { writeMv(c, z); }}
                onBoundsChange={(b) => {
                  try { sessionStorage.setItem('view:map:bounds', JSON.stringify(b)); } catch {}
                }}
                fitBounds={fitToBounds}
                fitPadding={viewport.w < 768 ? 40 : (viewport.w/viewport.h >= 1.4 ? 120 : 80)}
                clusterAnimate={clusterAnim}
                centerOffsetPixels={{ x: 0, y: -95 }}
              />
                {/* Zoom controls: bottom-right vertical + / - */}
                <div className="pointer-events-none absolute bottom-4 right-3 flex flex-col gap-2 mb-4 z-[12000]">
                  <button
                    onClick={() => setMapView(v => ({ ...v, zoom: Math.max(3, Math.min(19, v.zoom + 1)) }))}
                    className="pointer-events-auto h-12 w-12 rounded-full bg-white shadow-md border border-black/10 flex items-center justify-center"
                    aria-label="Zoom in"
                  >
                    <Plus size={18} />
                  </button>
                  <button
                    onClick={() => setMapView(v => ({ ...v, zoom: Math.max(3, Math.min(19, v.zoom - 1)) }))}
                    className="pointer-events-auto h-12 w-12 rounded-full bg-white shadow-md border border-black/10 flex items-center justify-center"
                    aria-label="Zoom out"
                  >
                    <Minus size={18} />
                  </button>
                </div>
            </div>
          )
        ) : (
          // Near-square screens
          selectedStory ? (
            selectedStory.geo ? (
              <div className="grid w-full h-full" style={{ gridTemplateColumns: '1fr 56.25vh' }}>
                {/* Left column fills remaining width with map + description */}
                <div className="flex flex-col h-full min-w-0">
                  <div className="flex-1 min-h-0">
                    <Map
                      stories={visibleStories}
                      onStorySelect={handleStorySelect}
                      selectedStoryId={selectedStory?.id}
                      center={{ lat:  mapView.center.lat, lng: mapView.center.lng }}
                      zoom={mapView.zoom}
                      onViewChange={(c, z) => { writeMv(c, z); }}
                      onBoundsChange={(b) => {
                        try { sessionStorage.setItem('view:map:bounds', JSON.stringify(b)); } catch {}
                      }}
                      fitBounds={fitToBounds}
                      clusterAnimate={clusterAnim}
                      centerOffsetPixels={{ x: 0, y: -95 }}
                    />
                  </div>
                  <div className="flex-1 min-h-0 bg-white overflow-hidden">
                    <div className="h-full">
                      <StoryMetadata
                        story={selectedStory}
                        currentPanel={selectedStory.panels[0]}
                      />
                    </div>
                  </div>
                </div>

                {/* Right viewer fixed 9:16 */}
                <div className="flex items-center justify-center" style={{ height: '100vh' }}>
                  <div style={{ width: '56.25vh', height: '100vh' }}>
                    <TwoPanelStoryViewer
                      initialStoryId={selectedStory.id}
                      initialPanelId={selectedPanelId}
                      stories={stories}
                      onClose={handleCloseStory}
                      hideMetadataPanel
                      hideRightPanel
                    />
                  </div>
                </div>
              </div>
            ) : (
              // No geo: center the viewer + description columns
              <div className="grid w-full h-full" style={{ gridTemplateColumns: '1fr 56.25vh minmax(0,56.25vh) 1fr' }}>
                <div />
                <div className="flex items-center justify-center" style={{ height: '100vh' }}>
                  <div style={{ width: '56.25vh', height: '100vh' }}>
                    <TwoPanelStoryViewer
                      initialStoryId={selectedStory.id}
                      initialPanelId={selectedPanelId}
                      stories={stories}
                      onClose={handleCloseStory}
                      hideMetadataPanel
                      hideRightPanel
                    />
                  </div>
                </div>
                <div className="bg-white relative">
                  <button
                    onClick={handleCloseStory}
                    className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center"
                    aria-label="Fermer"
                  >
                    <X size={22} />
                  </button>
                  <div className="h-full">
                    <StoryMetadata
                      story={selectedStory}
                      currentPanel={selectedStory.panels[0]}
                    />
                  </div>
                </div>
                <div />
              </div>
            )
          ) : (
            <div className="w-full h-full">
              <Map
                stories={visibleStories}
                onStorySelect={handleStorySelect}
                selectedStoryId={undefined}
                center={{ lat:  mapView.center.lat, lng: mapView.center.lng }}
                zoom={mapView.zoom}
                onViewChange={(c, z) => { setMapView({ center: c, zoom: z }); writeMv(c, z); }}
                onBoundsChange={(b) => {
                  try { sessionStorage.setItem('view:map:bounds', JSON.stringify(b)); } catch {}
                }}
                fitBounds={fitToBounds}
                clusterAnimate={clusterAnim}
                centerOffsetPixels={{ x: 0, y: -95 }}
              />
                {/* Zoom controls: bottom-right vertical + / - */}
                <div className="pointer-events-none absolute bottom-4 right-3 flex flex-col gap-2 mb-4 z-[12000]">
                  <button
                    onClick={() => setMapView(v => ({ ...v, zoom: Math.max(3, Math.min(19, v.zoom + 1)) }))}
                    className="pointer-events-auto h-12 w-12 rounded-full bg-white shadow-md border border-black/10 flex items-center justify-center"
                    aria-label="Zoom in"
                  >
                    <Plus size={18} />
                  </button>
                  <button
                    onClick={() => setMapView(v => ({ ...v, zoom: Math.max(3, Math.min(19, v.zoom - 1)) }))}
                    className="pointer-events-auto h-12 w-12 rounded-full bg-white shadow-md border border-black/10 flex items-center justify-center"
                    aria-label="Zoom out"
                  >
                    <Minus size={18} />
                  </button>
                </div>
            </div>
          )
        )}
      </div>
      )}
    </div>
  );
};

export default MapView;
