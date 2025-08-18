import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LatestArticlesGallery } from '@/components/LatestArticlesGallery';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { useStories } from '@/hooks/useStories';
import { Story } from '@/types/story';
import { Button } from '@/components/ui/button';
import { Map } from 'lucide-react';

const GalleryPage = () => {
  const { data: stories, isLoading, error } = useStories();
  const [selected, setSelected] = useState<Story | null>(null);

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

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 flex justify-end">
        <Link to="/map">
          <Button variant="outline" className="bg-white/10 border-white/20">
            <Map size={16} className="mr-2" />
            Map View
          </Button>
        </Link>
      </div>

      <LatestArticlesGallery onSelect={(story) => setSelected(story)} />

      {selected && (
        <div className="fixed inset-0 z-50 bg-black">
          <TwoPanelStoryViewer
            initialStoryId={selected.id}
            stories={stories}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  );
};

export default GalleryPage;

