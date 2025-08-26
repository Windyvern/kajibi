import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LatestArticlesGallery } from '@/components/LatestArticlesGallery';
import { TwoPanelStoryViewer } from '@/components/TwoPanelStoryViewer';
import { useStories } from '@/hooks/useStories';
import { Story } from '@/types/story';
import { Button } from '@/components/ui/button';
import { List as ListIcon } from 'lucide-react';
import { ViewToggle } from '@/components/ViewToggle';
import { SearchBar } from '@/components/SearchBar';
import { useSearchFilter } from '@/hooks/useSearchFilter';
import OptionsPopover from '@/components/OptionsPopover';
import { useOptions } from '@/context/OptionsContext';

const GalleryPage = () => {
  const { data: stories, isLoading, error } = useStories();
  const [selected, setSelected] = useState<Story | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { showClosed } = useOptions();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const listParam = params.get('list');
  const prizeParam = params.get('prize');
  const q = params.get('q');
  // Restore scroll if returning from a story in gallery context
  const locKey = `${location.pathname}${location.search}`;
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(`scroll:${locKey}`);
      if (v) {
        window.requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(v, 10) || 0);
          sessionStorage.removeItem(`scroll:${locKey}`);
        });
      }
    } catch {}
  }, [locKey]);

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
  let displayedStories = q ? filtered : baseStories;
  if (!showClosed) displayedStories = displayedStories.filter(s => !s.isClosed);

  // Priority: Stories whose markers are currently within last map bounds go first
  try {
    const bRaw = sessionStorage.getItem('view:map:bounds');
    if (bRaw) {
      const b = JSON.parse(bRaw) as { north: number; south: number; east: number; west: number };
      const inBounds: Story[] = [];
      const outBounds: Story[] = [];
      for (const s of displayedStories) {
        const g = s.geo;
        if (g && g.lat <= b.north && g.lat >= b.south && g.lng <= b.east && g.lng >= b.west) inBounds.push(s); else outBounds.push(s);
      }
      // Preserve internal ordering: if search is active, we preserve search rank; else leave base ordering
      displayedStories = [...inBounds, ...outBounds];
    }
  } catch {}

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
      <div className="px-4 md:px-3 pt-4">
        {/* Desktop / wide screens: row with centered search and right actions */}
        <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[1fr_auto_1fr] md:items-start md:gap-4 fixedright-3">
          <div className="hidden lg:block"/>
          <div className="md:justify-self-start lg:justify-self-center md:w-full lg:w-[620px] xl:w-[720px]">
            <SearchBar
              className="w-full"
              showFilters={filtersOpen}
              onToggleFilters={() => setFiltersOpen(o => !o)}
            />
          </div>
          <div className="flex items-center justify-end gap-2 relative">

            <Link to="/lists">
              <Button variant="outline" className="bg-white/10 border-white/20">
                <ListIcon size={16} className="mr-2" />
                Listes
              </Button>
            </Link>
            <OptionsPopover />
            <ViewToggle mode="route" />

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
          <div className="flex items-center justify-end gap-2 relative">
            <Link to="/lists">
              <Button variant="outline" className="bg-white/10 border-white/20">
                <ListIcon size={16} className="mr-2" />
                Listes
              </Button>
            </Link>
            <OptionsPopover />
            <ViewToggle mode="route" />
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
          const current = `${location.pathname}${location.search}`;
          // Save scroll position for gallery return
          try { sessionStorage.setItem(`scroll:${current}`, String(window.scrollY)); } catch {}
          const from = `from=${encodeURIComponent(current)}`;
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
