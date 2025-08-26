import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useList } from '@/hooks/useList';
import { useStories } from '@/hooks/useStories';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { LatestArticlesGallery } from '@/components/LatestArticlesGallery';
import { Story } from '@/types/story';
import { ViewToggle } from '@/components/ViewToggle';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { Map } from '@/components/Map';

const ListDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: list, isLoading, error } = useList(slug || '');
  const { data: stories } = useStories();
  const [params] = useSearchParams();
  const disableMap = params.get('map') === 'off';

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

  // Build combined media panels: first all media from each article, then list-level media
  const articleStories = (stories || []).filter((s) => (list.articles || []).some((a) => a.slug ? a.slug === s.handle : a.id === s.id));
  const articleMedias: Array<{ url: string; type: 'image' | 'video' }> = [];
  for (const a of (list.articles || [])) {
    for (const s of articleStories) {
      if ((s.handle && a.slug && s.handle === a.slug) || s.id === a.id) {
        for (const p of s.panels) {
          if (p.media) articleMedias.push({ url: p.media, type: p.type === 'video' ? 'video' : 'image' });
        }
      }
    }
  }
  const listMedias = (list.media || []);
  const combined = [...articleMedias, ...listMedias];

  // Decide rendering mode
  const showViewer = combined.length > 0;

  // Super Story for viewer
  const superStory: Story | null = showViewer ? {
    id: `list-${list.slug || list.id}`,
    title: list.name,
    author: '',
    handle: list.slug,
    publishedAt: new Date().toISOString(),
    description: list.description,
    panels: combined.map((m, i) => ({ id: `p-${i}`, type: m.type, media: m.url, orderIndex: i })),
    thumbnail: (combined[0]?.url) || undefined,
  } as Story : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 flex justify-end gap-2">
        <ViewToggle mode="route" />
      </div>

      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">{list.name}</h1>
        {list.description && (
          <p className="text-muted-foreground mb-6 max-w-2xl">{list.description}</p>
        )}
        {/* Map above the story player when there is geo */}
        {!disableMap && articleStories.some(s => s.geo) && (
          <div className="mb-6 h-[40vh] rounded-lg overflow-hidden border">
            <Map
              stories={articleStories.filter(s => s.geo)}
              onStorySelect={(s) => {
                navigate(`/story/${encodeURIComponent(s.handle || s.id)}?from=${encodeURIComponent(location.pathname + location.search)}`);
              }}
              fitBounds={(function(){
                const pts = articleStories.filter(s=>s.geo).map(s=>[s.geo!.lat, s.geo!.lng]) as [number,number][];
                if (pts.length>=2){
                  let minLat=pts[0][0],maxLat=pts[0][0],minLng=pts[0][1],maxLng=pts[0][1];
                  for(const [la,ln] of pts){minLat=Math.min(minLat,la);maxLat=Math.max(maxLat,la);minLng=Math.min(minLng,ln);maxLng=Math.max(maxLng,ln);} 
                  return [[minLat,minLng],[maxLat,maxLng]] as [[number,number],[number,number]];
                }
                return undefined;
              })()}
              fitPadding={80}
              suppressZoomOnMarkerClick
            />
          </div>
        )}

        {showViewer && superStory ? (
          <div>
            <div className="mx-auto" style={{ width: '56.25vh', maxWidth: '100%', height: '80vh' }}>
              <TwoPanelStoryViewer
                initialStoryId={superStory.id}
                stories={[superStory]}
                onClose={() => navigate(-1)}
                hideRightPanel
                hideMetadataPanel
              />
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-semibold mb-4">Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6 xl:max-w-[1460px] mx-auto">
              {articleStories.map((story) => (
                <div
                  key={story.id}
                  className="relative group cursor-pointer transition-transform hover:scale-105 duration-200"
                  onClick={() => {
                    const current = `${location.pathname}${location.search}`;
                    try { sessionStorage.setItem(`scroll:${current}`, String(window.scrollY)); } catch {}
                    navigate(`/story/${encodeURIComponent(story.handle || story.id)}?from=${encodeURIComponent(current)}`);
                  }}
                >
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg">
                    {story.thumbnail && (
                      <img src={story.thumbnail} alt={story.title} className={`w-full h-full object-cover ${story.isClosed ? 'grayscale' : ''}`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg line-clamp-2 flex-1">{story.title}</h3>
                        {story.isClosed && <span className="px-2 py-0.5 text-xs rounded-full bg-red-600 text-white whitespace-nowrap">Fermé</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListDetailPage;
