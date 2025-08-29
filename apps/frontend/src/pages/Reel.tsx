import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useReels } from '@/hooks/useReels';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { Loader2, X } from 'lucide-react';
import { StoryMetadata } from '@/components/StoryMetadata';

const ReelPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: allStories, isLoading, error } = useReels();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialPanelId = params.get('panel') || undefined;
  const story = useMemo(() => (allStories || []).find(s => (s.handle || '').toLowerCase() === (slug || '').toLowerCase()) || null, [allStories, slug]);

  // Get the ordered stories and context from sessionStorage
  const { orderedStories, viewerContext, isGalleryMobile } = useMemo(() => {
    try {
      const orderedIds = JSON.parse(sessionStorage.getItem('viewer:reels:orderedIds') || '[]');
      const context = sessionStorage.getItem('viewer:reels:context') || 'single';
      
      if (orderedIds.length > 0 && allStories) {
        const ordered = orderedIds.map((id: string) => allStories.find(s => s.id === id)).filter(Boolean);
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const isGalleryContext = context === 'gallery';
        
        return {
          orderedStories: ordered,
          viewerContext: context,
          isGalleryMobile: isMobile && isGalleryContext
        };
      }
    } catch {}
    
    return {
      orderedStories: story ? [story] : [],
      viewerContext: 'single',
      isGalleryMobile: false
    };
  }, [allStories, story]);

  if (isLoading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Chargement…</div>;
  if (error || !story) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Introuvable</div>;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="grid w-full h-full bg-white" style={{ gridTemplateColumns: '1fr 56.25vh minmax(0,56.25vh) 1fr' }}>
        <div />
        <div className="flex items-center justify-center" style={{ height: '100vh' }}>
          <div style={{ width: '56.25vh', height: '100vh' }}>
            <TwoPanelStoryViewer
              initialStoryId={story.id}
              initialPanelId={initialPanelId}
              stories={orderedStories}
              onClose={() => navigate(-1)}
              hideRightPanel
              advanceStoryOnMobile={isGalleryMobile}
            />
          </div>
        </div>
        <div className="bg-white relative">
          <button onClick={() => navigate(-1)} className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X size={22} /></button>
          <div className="h-full">
            <StoryMetadata story={{ ...story, postedDate: story.postedDate || story.publishedAt }} currentPanel={story.panels[0]} hideUsername />
            {/* Mentions bubbles */}
            {Array.isArray(story.mentions) && story.mentions.length > 0 && (
              <div className="px-6 pb-6">
                <div className="flex flex-wrap gap-2 mb-4">
                  {story.mentions.map((m) => (
                    <button key={m} onClick={() => navigate(`/authors/${encodeURIComponent(m)}`)} className="px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-sm">@{m}</button>
                  ))}
                </div>
              </div>
            )}
            {/* Linked articles chips */}
            {Array.isArray(story.linkedArticles) && story.linkedArticles.length > 0 && (
              <div className="px-6 pb-6">
                <div className="flex flex-wrap gap-2">
                  {story.linkedArticles.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => navigate(`/story/${encodeURIComponent(a.slug || a.id)}`)}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-sm"
                    >
                      {a.thumbnail && <img src={a.thumbnail} className="w-6 h-6 rounded object-cover" />}
                      <span className="truncate max-w-[14ch]">{a.title || 'Article'}</span>
                      {a.username && <span className="text-gray-500">@{a.username}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div />
      </div>
    </div>
  );
};

export default ReelPage;
