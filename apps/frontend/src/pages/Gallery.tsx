import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LatestArticlesGallery } from '@/components/LatestArticlesGallery';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { useStories } from '@/hooks/useStories';
import { Story } from '@/types/story';
import { Button } from '@/components/ui/button';
import { Map, List as ListIcon } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { useSearchFilter } from '@/hooks/useSearchFilter';

const GalleryPage = () => {
  const { data: stories, isLoading, error } = useStories();
  const [selected, setSelected] = useState<Story | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const listParam = params.get('list');
  const prizeParam = params.get('prize');
  const q = params.get('q');

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
  let baseStories = stories || [];
  if (listParam) {
    baseStories = baseStories.filter((s) => (s.lists || []).some((l) => (l.slug || l.id) === listParam));
  }
  if (prizeParam) {
    baseStories = baseStories.filter((s) => (s.prizes || []).some((p) => (p.slug || p.id) === prizeParam));
  }
  const sf = params.get('sf') || 't,u,a,d,i';
  const fields = {
    title: sf.includes('t'),
    username: sf.includes('u'),
    address: sf.includes('a'),
    description: sf.includes('d'),
    images: sf.includes('i'),
  } as const;
  const { filtered, matchedPanelByStory, scores } = useSearchFilter(baseStories, q, fields);
  const displayedStories = q ? filtered : baseStories;

  const listTitle = (() => {
    if (listParam) {
      for (const s of stories || []) {
        const m = (s.lists || []).find((l) => (l.slug || l.id) === listParam);
        if (m?.name) return m.name;
      }
      return listParam;
    }
    if (prizeParam) {
      for (const s of stories || []) {
        const p = (s.prizes || []).find((p) => (p.slug || p.id) === prizeParam);
        if (p?.name) return p.name;
      }
      return prizeParam;
    }
    return null;
  })();

  return (
    <div className="min-h-screen bg-background">
      {/* Responsive header with padding around search */}
      <div className="px-4 md:px-6 pt-4">
        {/* Desktop / wide screens: row with centered search and right actions */}
        <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:items-start md:gap-4">
          <div />
          <div className="justify-self-center w-full md:w-[540px] lg:w-[620px] xl:w-[720px]">
            <SearchBar
              showFilters={filtersOpen}
              onToggleFilters={() => setFiltersOpen(o => !o)}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
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
        </div>

        {/* Mobile: stacked search then actions */}
        <div className="md:hidden flex flex-col gap-2">
          <div className="w-full md:w-[720px] mx-auto">
            <SearchBar
              showFilters={filtersOpen}
              onToggleFilters={() => setFiltersOpen(o => !o)}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
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
        </div>
      </div>

      {(listParam || prizeParam || q) && (
        <div className="px-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">
              {listTitle || 'Résultats'}
              {q && (
                <span className="ml-2 text-base text-muted-foreground">({displayedStories.length} résultat{displayedStories.length !== 1 ? 's' : ''})</span>
              )}
            </h2>
            <button
              onClick={() => navigate('/gallery')}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              × Fermer
            </button>
          </div>
        </div>
      )}

      <LatestArticlesGallery
        stories={displayedStories}
        onSelect={(story) => {
          const pid = q ? matchedPanelByStory[story.id] : undefined;
          const base = `/story/${encodeURIComponent(story.handle || story.id)}`;
          const from = 'from=gallery';
          navigate(
            pid
              ? `${base}?${from}&panel=${encodeURIComponent(pid)}`
              : `${base}?${from}`
          );
        }}
      />

      {/* Viewer is now handled by /story/:slug route */}
    </div>
  );
};

export default GalleryPage;
