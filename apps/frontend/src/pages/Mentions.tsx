import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { List as ListIcon } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { useState, useMemo, useEffect } from 'react';
import { useStories } from '@/hooks/useStories';
import { LatestArticlesGallery } from '@/components/LatestArticlesGallery';
import { ViewToggle } from '@/components/ViewToggle';
import { Map as StoriesMap } from '@/components/Map';
import { Story } from '@/types/story';
import OptionsPopover from '@/components/OptionsPopover';
import { useOptions } from '@/context/OptionsContext';

const MentionsPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const style = params.get('style') === 'map' ? 'map' : 'gallery';
  const { data: stories } = useStories();
  const { showClosed } = useOptions();

  const prizeStories: Story[] = useMemo(() => {
    const all = stories || [];
    const filtered = all.filter(s => (s.prizes || []).some(p => (p.slug || p.id)?.toString() === slug));
    return showClosed ? filtered : filtered.filter(s => !s.isClosed);
  }, [stories, slug, showClosed]);

  // Restore gallery scroll when returning from a story
  useEffect(() => {
    const key = `${location.pathname}${location.search}`;
    try {
      const v = sessionStorage.getItem(`scroll:${key}`);
      if (v && style !== 'map') {
        window.requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(v, 10) || 0);
          sessionStorage.removeItem(`scroll:${key}`);
        });
      }
    } catch {}
  }, [location.pathname, location.search, style]);

  // Bounds-prioritized ordering for gallery
  const orderedStories: Story[] = useMemo(() => {
    try {
      const bRaw = sessionStorage.getItem('view:map:bounds');
      if (!bRaw) return prizeStories;
      const b = JSON.parse(bRaw) as { north: number; south: number; east: number; west: number };
      const inB: Story[] = [];
      const outB: Story[] = [];
      for (const s of prizeStories) {
        const g = s.geo;
        if (g && g.lat <= b.north && g.lat >= b.south && g.lng <= b.east && g.lng >= b.west) inB.push(s); else outB.push(s);
      }
      return [...inB, ...outB];
    } catch {
      return prizeStories;
    }
  }, [prizeStories]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header with centered search and right nav (desktop), stacked on mobile */}
      <div className="px-4 md:px-6 pt-4">
        <div className="hidden md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-4">
          <div />
          <div className="justify-self-start w-full lg:w-[620px] xl:w-[720px]">
            <SearchBar showFilters={filtersOpen} onToggleFilters={() => setFiltersOpen(o => !o)} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Link to="/lists">
              <Button variant="outline" className="bg-white/10 border-white/20">
                <ListIcon size={16} className="mr-2" />
                Listes
              </Button>
            </Link>
            <OptionsPopover />
            <ViewToggle mode="query" />
          </div>
        </div>
        <div className="md:hidden flex flex-col gap-2">
          <div className="w-full md:w-[720px] mx-auto">
            <SearchBar showFilters={filtersOpen} onToggleFilters={() => setFiltersOpen(o => !o)} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <ViewToggle mode="query" showLabels={false} />
          </div>
        </div>
      </div>

      <div className="px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Mentions</h2>
        </div>
      </div>

      {style === 'map' ? (
        <div className="h-[70vh] w-full">
          <StoriesMap
            stories={prizeStories}
            onStorySelect={(story) => {
              const current = `${location.pathname}${location.search}`;
              const base = `/story/${encodeURIComponent(story.handle || story.id)}`;
              navigate(`${base}?from=${encodeURIComponent(current)}`);
            }}
            selectedStoryId={undefined}
            center={{ lat: 48.8566, lng: 2.3522 }}
            zoom={4}
            onViewChange={() => {}}
            fitPadding={40}
          />
        </div>
      ) : (
        <LatestArticlesGallery
          stories={orderedStories}
          onSelect={(story) => {
            const current = `${location.pathname}${location.search}`;
            try { sessionStorage.setItem(`scroll:${current}`, String(window.scrollY)); } catch {}
            navigate(`/story/${encodeURIComponent(story.handle || story.id)}?from=${encodeURIComponent(current)}`);
          }}
        />
      )}
    </div>
  );
};

export default MentionsPage;
