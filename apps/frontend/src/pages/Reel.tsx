import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useReels } from '@/hooks/useReels';
import ReelPlayer from '@/components/ReelPlayer';

const ReelPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: stories, isLoading, error } = useReels();
  const navigate = useNavigate();
  const story = useMemo(() => (stories || []).find(s => (s.handle || '').toLowerCase() === (slug || '').toLowerCase()) || null, [stories, slug]);

  if (isLoading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Chargement…</div>;
  if (error || !story) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Introuvable</div>;

  // Pick the first video panel for the reel
  const videoPanel = story.panels.find(p => p.type === 'video' && p.media);
  const src = videoPanel?.media || story.thumbnail || '';

  return (
    <div className="fixed inset-0 z-50 bg-black grid" style={{ gridTemplateColumns: '1fr 56.25vh 1fr' }}>
      <div />
      <div className="flex items-center justify-center" style={{ height: '100vh' }}>
        <div style={{ width: '56.25vh', height: '100vh' }}>
          <ReelPlayer src={src} onClose={() => navigate(-1)} />
        </div>
      </div>
      <div />
      {/* Mentions bubbles above description (right side panel omitted in minimal reel) */}
      {Array.isArray(story.mentions) && story.mentions.length > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-24 w-[56.25vh] px-6">
          <div className="flex flex-wrap gap-2 justify-center">
            {story.mentions.map((m) => (
              <button key={m} onClick={() => navigate(`/authors/${encodeURIComponent(m)}`)} className="px-3 py-1 rounded-full bg-white/20 text-white text-sm hover:bg-white/30">@{m}</button>
            ))}
          </div>
        </div>
      )}
      {/* Linked articles chips below player */}
      {Array.isArray(story.linkedArticles) && story.linkedArticles.length > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-8 w-[56.25vh] px-6">
          <div className="flex flex-wrap gap-2 justify-center">
            {story.linkedArticles.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/story/${encodeURIComponent(a.slug || a.id)}`)}
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-white/20 text-white text-sm hover:bg-white/30"
              >
                {a.thumbnail && <img src={a.thumbnail} className="w-6 h-6 rounded object-cover" />}
                <span className="truncate max-w-[14ch]">{a.title || 'Article'}</span>
                {a.username && <span className="opacity-90">@{a.username}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReelPage;
