import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStories } from '@/hooks/useStories';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { Loader2 } from 'lucide-react';

const StoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: stories, isLoading, error } = useStories();

  const target = useMemo(() => {
    if (!stories || !slug) return null;
    return stories.find((s) => (s.handle || '').toLowerCase() === slug.toLowerCase()) || null;
  }, [stories, slug]);

  useEffect(() => {
    if (!isLoading && stories && !target) {
      // unknown slug -> back to gallery
      navigate('/gallery', { replace: true });
    }
  }, [isLoading, stories, target, navigate]);

  if (isLoading || !stories) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin" size={20} />
          <span>Chargement…</span>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <span>Erreur de chargement</span>
      </div>
    );
  }
  if (!target) return null;

  // If story has geo, show it in Map UI instead
  if (target.geo) {
    navigate(`/map?story=${encodeURIComponent(target.handle || target.id)}`, { replace: true });
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <TwoPanelStoryViewer
        initialStoryId={target.id}
        stories={stories}
        onClose={() => navigate('/gallery')}
      />
    </div>
  );
};

export default StoryPage;
