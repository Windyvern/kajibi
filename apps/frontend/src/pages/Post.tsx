import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usePosts } from '@/hooks/usePosts';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { Loader2, X } from 'lucide-react';
import { StoryMetadata } from '@/components/StoryMetadata';

const PostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: stories, isLoading, error } = usePosts();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialPanelId = params.get('panel') || undefined;
  const story = useMemo(() => (stories || []).find(s => (s.handle || '').toLowerCase() === (slug || '').toLowerCase()) || null, [stories, slug]);

  if (isLoading) return <div className="min-h-screen bg-black text-white flex items-center justify-center"><Loader2 className="animate-spin" size={20} /></div>;
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
              stories={[story]}
              onClose={() => navigate(-1)}
              hideRightPanel
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

export default PostPage;
