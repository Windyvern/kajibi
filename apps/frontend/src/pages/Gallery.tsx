import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LatestArticlesGallery } from '@/components/LatestArticlesGallery';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { useStories } from '@/hooks/useStories';
import { Story } from '@/types/story';
import { Button } from '@/components/ui/button';
import { Map, List as ListIcon } from 'lucide-react';

const GalleryPage = () => {
  const { data: stories, isLoading, error } = useStories();
  const [selected, setSelected] = useState<Story | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const listParam = params.get('list');

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
  const displayedStories = !stories ? [] : listParam
    ? stories.filter((s) => (s.lists || []).some((l) => (l.slug || l.id) === listParam))
    : stories;

  const listTitle = (() => {
    if (!listParam) return null;
    for (const s of stories || []) {
      const m = (s.lists || []).find((l) => (l.slug || l.id) === listParam);
      if (m?.name) return m.name;
    }
    return listParam;
  })();

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 flex justify-end gap-2">
        <Link to="/lists">
          <Button variant="outline" className="bg-white/10 border-white/20">
            <ListIcon size={16} className="mr-2" />
            Listes
          </Button>
        </Link>
        <Link to="/map">
          <Button variant="outline" className="bg-white/10 border-white/20">
            <Map size={16} className="mr-2" />
            Carte
          </Button>
        </Link>
      </div>

      {listParam && (
        <div className="px-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">{listTitle}</h2>
            <button
              onClick={() => navigate('/gallery')}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              × Fermer
            </button>
          </div>
        </div>
      )}

      <LatestArticlesGallery stories={displayedStories} onSelect={(story) => navigate(`/story/${encodeURIComponent(story.handle || story.id)}`)} />

      {/* Viewer is now handled by /story/:slug route */}
    </div>
  );
};

export default GalleryPage;
