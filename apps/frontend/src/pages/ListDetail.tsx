import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useList } from '@/hooks/useList';
import { useStories } from '@/hooks/useStories';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { LatestArticlesGallery } from '@/components/LatestArticlesGallery';
import { Story } from '@/types/story';
import { ViewToggle } from '@/components/ViewToggle';

const ListDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: list, isLoading, error } = useList(slug || '');
  const { data: stories } = useStories();

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

        {showViewer && superStory ? (
          <div className="fixed inset-0 z-50 bg-black">
            <TwoPanelStoryViewer
              initialStoryId={superStory.id}
              stories={[superStory]}
              onClose={() => navigate(-1)}
            />
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-semibold mb-4">Articles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                      <img src={story.thumbnail} alt={story.title} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                      <h3 className="font-semibold text-lg mb-1 line-clamp-2">{story.title}</h3>
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
