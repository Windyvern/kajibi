import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ViewToggle } from '@/components/ViewToggle';
import ListHeader from '@/components/ListHeader';
import { useList } from '@/hooks/useList';
import { useStories } from '@/hooks/useStories';
import { LatestArticlesGallery, ListSidebarGallery } from '@/components/LatestArticlesGallery';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { StoryMetadata } from '@/components/StoryMetadata';
import { Story } from '@/types/story';
import { Map } from '@/components/Map';

const ListDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const style = params.get('style') === 'map' ? 'map' : 'gallery';
  const { data: list, isLoading, error } = useList(slug || '');
  const { data: stories } = useStories();

  // Restore gallery scroll when returning from a story
  useEffect(() => {
    const key = `${location.pathname}${location.search}`;
    try {
      const v = sessionStorage.getItem(`scroll:${key}`);
      if (v && style !== 'map') {
        window.requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(v, 10) || 0);
          sessionStorage.removeItem(`scroll:${key}`);
        });
      }
    } catch {}
  }, [location.pathname, location.search, style]);

  // Stories belonging to this list (by slug or id)
  const articleStories = useMemo(() => {
    const all = stories || [];
    const ids = new Set(((list?.articles) || []).map(a => a.slug || a.id));
    return all.filter(s => ids.has(s.handle || s.id));
  }, [stories, list?.articles]);

  // Compute fitBounds from a set of stories with geo
  const computeBounds = (src: Story[]) => {
    const pts = src.filter(s => s.geo).map(s => [s.geo!.lat, s.geo!.lng]) as [number, number][];
    if (pts.length >= 2) {
      let minLat = pts[0][0], maxLat = pts[0][0], minLng = pts[0][1], maxLng = pts[0][1];
      for (const [la, ln] of pts) { minLat = Math.min(minLat, la); maxLat = Math.max(maxLat, la); minLng = Math.min(minLng, ln); maxLng = Math.max(maxLng, ln); }
      return [[minLat, minLng], [maxLat, maxLng]] as [[number, number], [number, number]];
    }
    return undefined;
  };

  // Build pseudo-stories for media lists: each media panel becomes a single-panel story using parent article metadata
  const mediaStories: Story[] = useMemo(() => {
    if (((list?.listType) || 'articles') !== 'media') return [];
    const out: Story[] = [];
    for (const s of articleStories) {
      for (const p of s.panels) {
        if (!p.media) continue;
        out.push({
          id: `${s.id}::${p.id}`,
          title: s.title,
          author: s.author,
          authorSlug: s.authorSlug,
          handle: s.handle,
          publishedAt: s.publishedAt,
          panels: [{ ...p, orderIndex: 0 }],
          thumbnail: p.type === 'image' && p.media ? p.media : (s.thumbnail || undefined),
          username: s.username,
          avatarUrl: s.avatarUrl,
          prizes: s.prizes,
          tags: s.tags,
          address: s.address,
          description: s.description,
          lists: s.lists,
          geo: s.geo,
          isClosed: s.isClosed,
          category: s.category,
          types: s.types,
        });
      }
    }
    return out;
  }, [articleStories, list?.listType]);

  // Map view state for media viewer (center without changing zoom on selection)
  const [mapView, setMapView] = useState<{ center?: { lat: number; lng: number }, zoom: number }>({ zoom: 5 });

  // Selected article (articles lists) for right-panel viewer
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);

  // Selected index for inline viewer (media lists)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedMediaStory = (selectedIndex != null && mediaStories[selectedIndex]) || null;

  const listType = (list?.listType) || 'articles';
  const storiesForMap = (listType === 'media') ? mediaStories : articleStories;
  const boundsForMap = computeBounds(storiesForMap);

  // Header should reflect the currently displayed article/media when selected
  const headerTitle = selectedMediaStory
    ? selectedMediaStory.title
    : (selectedStory ? selectedStory.title : (list?.name || ''));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin" size={20} />
          <span>Chargement…</span>
        </div>
      </div>
    );
  }
  if (error || !list) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span>Erreur de chargement</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 mt-12">
        <ListHeader></ListHeader>
        {list.description && (
          <p className="text-muted-foreground mb-4 text-center max-w-2xl mx-auto">{list.description}</p>
        )}
      </div>

      {/* Main content: two-panel (map left, gallery/viewer right) on larger screens */}
      {listType === 'media' ? (
        // MEDIA LISTS: map left; right shows gallery or unified viewer across all media
        <div className="flex-1 w-full mt-[85px] md:mt-12">
          <div className="grid w-full h-full bg-white" style={{ gridTemplateColumns: '1fr 56.25vh' }}>
            {/* Left: Map */}
            <div className="min-w-0">
              <Map
                stories={mediaStories}
                onStorySelect={(s) => {
                  const idx = mediaStories.findIndex(ms => ms.id === s.id);
                  if (idx >= 0) setSelectedIndex(idx);
                  if (s.geo) setMapView(v => ({ center: s.geo!, zoom: v.zoom }));
                }}
                selectedStoryId={selectedMediaStory?.id}
                center={mapView.center}
                zoom={mapView.zoom}
                onViewChange={(c, z) => setMapView({ center: c, zoom: z })}
                fitBounds={boundsForMap}
                fitPadding={80}
                suppressZoomOnMarkerClick
              />
            </div>

            {/* Right: gallery or viewer */}
            <div className="relative min-w-0 overflow-hidden">
              {selectedMediaStory ? (
                <div className="flex items-center justify-center h-full">
                  <div style={{ width: '56.25vh', height: '100%' }}>
                    <TwoPanelStoryViewer
                      initialStoryId={selectedMediaStory.id}
                      stories={mediaStories}
                      onClose={() => setSelectedIndex(null)}
                      hideRightPanel
                      hideMetadataPanel
                      onStoryChange={(s) => { if (s.geo) setMapView(v => ({ center: s.geo!, zoom: v.zoom })); }}
                    />
                  </div>
                </div>
              ) : (
                <ListSidebarGallery
                  heading={list.name}
                  stories={mediaStories}
                  onSelect={(s) => {
                    // Open full-screen list map viewer with selected media marker
                    navigate(`/lists/${encodeURIComponent(list.slug || list.id)}/map?m=${encodeURIComponent(s.id)}`);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        // ARTICLES LISTS: map left; right shows gallery or inline viewer across the list's articles
        <div className="flex-1 w-full">
          <div className="grid w-full h-[calc(100svh-160px)] bg-white" style={{ gridTemplateColumns: '1fr 56.25vh' }}>
            {/* Left: Map */}
            <div className="min-w-0">
              <Map
                stories={articleStories.filter(s => s.geo)}
                onStorySelect={(s) => {
                  setSelectedStory(s);
                  if (s.geo) setMapView(v => ({ center: s.geo!, zoom: v.zoom }));
                }}
                selectedStoryId={selectedStory?.id}
                center={mapView.center}
                zoom={mapView.zoom}
                onViewChange={(c, z) => setMapView({ center: c, zoom: z })}
                fitBounds={boundsForMap}
                fitPadding={80}
              />
            </div>

            {/* Right: gallery or viewer */}
            <div className="relative min-w-0 overflow-hidden">
              {selectedStory ? (
                <div className="flex items-center justify-center h-full">
                  <div style={{ width: '56.25vh', height: '100%' }}>
                    <TwoPanelStoryViewer
                      initialStoryId={selectedStory.id}
                      stories={articleStories}
                      onClose={() => setSelectedStory(null)}
                      hideRightPanel
                      onStoryChange={(s) => { if (s.geo) setMapView(v => ({ center: s.geo!, zoom: v.zoom })); }}
                    />
                  </div>
                </div>
              ) : (
                <ListSidebarGallery
                  heading={list.name}
                  stories={articleStories}
                  onSelect={(s) => {
                    // Behave like clicking the corresponding map marker
                    setSelectedStory(s);
                    if (s.geo) setMapView(v => ({ center: s.geo!, zoom: v.zoom }));
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListDetailPage;
