import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useList } from '@/hooks/useList';
import { useStories } from '@/hooks/useStories';
import { Map } from '@/components/Map';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { Story, StoryPanelData } from '@/types/story';

const ListMapViewerPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: list } = useList(slug || '');
  const { data: stories } = useStories();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const disableMap = params.get('map') === 'off';

  const listStories = useMemo(() => {
    const all = stories || [];
    const ids = new Set((list?.articles || []).map(a => a.slug || a.id));
    return all.filter(s => ids.has(s.handle || s.id));
  }, [stories, list?.articles]);

  const [selected, setSelected] = useState<Story | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<string | undefined>(undefined);
  const [fit, setFit] = useState<[[number, number], [number, number]] | undefined>(undefined);

  useEffect(() => {
    const base = (list?.listType === 'media') ? mediaStories : listStories;
    const pts = base.filter(s => s.geo).map(s => [s.geo!.lat, s.geo!.lng]) as [number, number][];
    if (pts.length >= 2) {
      let minLat = pts[0][0], maxLat = pts[0][0], minLng = pts[0][1], maxLng = pts[0][1];
      for (const [la, ln] of pts) { minLat = Math.min(minLat, la); maxLat = Math.max(maxLat, la); minLng = Math.min(minLng, ln); maxLng = Math.max(maxLng, ln); }
      setFit([[minLat, minLng], [maxLat, maxLng]]);
    } else {
      setFit(undefined);
    }
  }, [listStories]);

  // Build media-mode synthetic stories
  const mediaStories: Story[] = useMemo(() => {
    if (!list || !stories) return [];
  const articleMap = new globalThis.Map<string, Story>();
    for (const s of stories) articleMap.set(s.handle || s.id, s);
    const out: Story[] = [];
    for (const a of (list.articles || [])) {
      const parent = articleMap.get(a.slug || a.id);
      const medias = a.media || [];
      medias.forEach((url: string, i: number) => {
        out.push({
          id: `${parent?.id || a.id}-m-${i}`,
          title: parent?.title || list.name,
          author: parent?.author || '',
          handle: `${parent?.handle || a.slug}-m-${i}`,
          publishedAt: parent?.publishedAt || new Date().toISOString(),
          panels: [{ id: 'p-0', type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image', media: url, orderIndex: 0 }],
          thumbnail: url,
          geo: parent?.geo,
        } as Story);
      });
    }
    // Optionally include list-level media without geo
    (list.media || []).forEach((m, i) => {
      out.push({
        id: `${list.id}-lm-${i}`,
        title: list.name,
        author: '',
        handle: `${list.slug}-lm-${i}`,
        publishedAt: new Date().toISOString(),
        panels: [{ id: 'p-0', type: m.type, media: m.url, orderIndex: 0 }],
        thumbnail: m.url,
      } as Story);
    });
    return out;
  }, [list, stories]);

  // Build a single concatenated story for media mode
  const mediaSuperStory: Story | null = useMemo(() => {
    if (!list) return null;
    const panels: StoryPanelData[] = [];
  const panelIdByMarkerId = new globalThis.Map<string, string>();
    let idx = 0;
    for (const s of mediaStories) {
      const p = s.panels[0];
      const id = `p-${idx++}`;
      panels.push({ ...p, id, orderIndex: idx });
      panelIdByMarkerId.set(s.id, id);
    }
    const firstThumb = mediaStories[0]?.thumbnail;
    const story: Story = {
      id: `list-${list.slug || list.id}-super`,
      title: list.name,
      author: '',
      handle: list.slug || String(list.id),
      publishedAt: new Date().toISOString(),
      panels,
      thumbnail: firstThumb,
    } as Story;
    // Attach map for local lookup
    (story as any).__panelIdByMarkerId = panelIdByMarkerId;
    return story;
  }, [list, mediaStories]);

  if (!list) return null;

  const handleClose = () => navigate(-1);

  return (
    <div className="fixed inset-0 z-50 bg-white">
      {!disableMap && (
        <div className="absolute inset-0">
          <Map
            stories={list?.listType === 'media' ? mediaStories : listStories}
            onStorySelect={(s) => {
              if (list?.listType === 'media' && mediaSuperStory) {
                const map = (mediaSuperStory as any).__panelIdByMarkerId as Map<string,string> | undefined;
                const pid = map?.get(s.id);
                setSelected(mediaSuperStory);
                setSelectedPanelId(pid);
              } else {
                setSelected(s);
              }
            }}
            selectedStoryId={list?.listType === 'media' ? undefined : selected?.id}
            fitBounds={fit}
            fitPadding={80}
            suppressZoomOnMarkerClick
          />
        </div>
      )}
      <div className="relative h-full flex items-center justify-center pointer-events-none">
        <div style={{ width: '56.25vh', height: '100vh' }} className="pointer-events-auto">
          <TwoPanelStoryViewer
            initialStoryId={(selected?.id) || (list?.listType === 'media' ? mediaSuperStory?.id : listStories[0]?.id)}
            initialPanelId={selectedPanelId}
            stories={list?.listType === 'media' && mediaSuperStory ? [mediaSuperStory] : listStories}
            onClose={handleClose}
            hideRightPanel
            hideMetadataPanel
          />
        </div>
      </div>
    </div>
  );
};

export default ListMapViewerPage;
